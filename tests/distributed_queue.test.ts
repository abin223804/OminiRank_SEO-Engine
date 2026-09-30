import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { queueManager } from "../lib/queue/manager";
import {
  verifyCronAuth,
  runDailyGscSyncCron,
  runWeeklyDigestCron,
  runMonthlyQuotaResetCron,
} from "../lib/queue/cron";

console.log("==================================================");
console.log("▶ RUNNING DISTRIBUTED BACKGROUND QUEUE & CRON TESTS");
console.log("==================================================\n");

async function runDistributedQueueTests() {
  const timestamp = Date.now();
  const testEmail = `queue-architect-${timestamp}@tekora.internal`;
  const workspaceSlug = `queue-ws-${timestamp}`;

  let testUserId: string | null = null;
  let testWorkspaceId: string | null = null;
  let testProjectId: string | null = null;

  try {
    // 1. Setup Test Fixtures on MongoDB Atlas
    console.log("1. Provisioning Workspace & Project Fixtures on MongoDB Atlas:");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Queue Engineer",
      },
    });
    testUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "Queue Performance Workspace",
        slug: workspaceSlug,
        planTier: "PRO",
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    testWorkspaceId = workspace.id;

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "Queue Test Target Domain",
        siteUrl: "https://www.queuetest.internal",
        gscPropertyId: "sc-domain:queuetest.internal",
        deploymentMode: "AUTO_PR",
      },
    });
    testProjectId = project.id;
    console.log(`   ✓ Workspace (${workspace.slug}) & Project (${project.name}) created in DB.`);

    // 2. Testing Standard Job Enqueue and Execution
    console.log("\n2. Testing Standard Job Enqueue and Worker Execution:");
    const gscJob = await queueManager.enqueue(
      "GSC_SYNC",
      {
        projectId: project.id,
        options: { forceMock: true },
      },
      {
        priority: 5,
        projectId: project.id,
        workspaceId: workspace.id,
      }
    );

    assert.ok(gscJob.id, "Enqueued job must have a valid ObjectId");
    assert.strictEqual(gscJob.status, "QUEUED");
    assert.strictEqual(gscJob.attempts, 0);
    assert.strictEqual(gscJob.priority, 5);
    console.log(`   ✓ Job '${gscJob.id}' enqueued with status 'QUEUED' and priority 5.`);

    // Execute via queueManager
    const executedGscJob = await queueManager.processNext("test_worker_1");
    assert.ok(executedGscJob, "Worker must successfully acquire and execute job");
    assert.strictEqual(executedGscJob.id, gscJob.id);
    assert.strictEqual(executedGscJob.status, "COMPLETED");
    assert.ok(executedGscJob.completedAt, "Job must have a completion timestamp");
    assert.strictEqual(executedGscJob.lockedAt, null, "Lock must be released on completion");
    assert.strictEqual(executedGscJob.error, null);
    console.log(`   ✓ Job '${executedGscJob.id}' processed to 'COMPLETED' with lock cleanly released.`);

    // 3. Testing Transient Failure & Exponential Backoff Retry
    console.log("\n3. Testing Transient Failure & Exponential Backoff Retry Mechanism:");
    let flakyAttempts = 0;
    queueManager.registerHandler("TEST_FLAKY_JOB", async (payload: any) => {
      flakyAttempts++;
      if (flakyAttempts === 1) {
        throw new Error("Transient network timeout connecting to Search Console");
      }
      return { success: true, attempt: flakyAttempts, payload };
    });

    const flakyJob = await queueManager.enqueue(
      "TEST_FLAKY_JOB",
      { testKey: "flaky_data" },
      {
        maxAttempts: 3,
        backoffDelayMs: 3000, // 3000ms base delay
      }
    );

    // Attempt 1: Should fail and enter exponential backoff
    const attempt1Result = await queueManager.processNext("flaky_worker");
    assert.ok(attempt1Result);
    assert.strictEqual(attempt1Result.id, flakyJob.id);
    assert.strictEqual(attempt1Result.status, "QUEUED", "Job should stay QUEUED for retry");
    assert.strictEqual(attempt1Result.attempts, 1);
    assert.ok(
      attempt1Result.error?.includes("Transient network timeout"),
      "Error message must be captured"
    );
    assert.ok(
      new Date(attempt1Result.nextRunAt).getTime() >= Date.now() + 1000,
      "nextRunAt must be set into the future via exponential backoff"
    );
    console.log(`   ✓ Attempt 1 failed gracefully: attempts=1, nextRunAt backed off exponentially.`);

    // Simulate backoff elapsing by setting nextRunAt to now
    await prisma.backgroundJob.update({
      where: { id: flakyJob.id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });

    // Attempt 2: Should succeed
    const attempt2Result = await queueManager.processNext("flaky_worker");
    assert.ok(attempt2Result);
    assert.strictEqual(attempt2Result.id, flakyJob.id);
    assert.strictEqual(attempt2Result.status, "COMPLETED");
    assert.strictEqual(attempt2Result.attempts, 1); // Note: attempts was 1 before success
    assert.strictEqual(attempt2Result.error, null);
    console.log(`   ✓ Attempt 2 succeeded: job transitioned to 'COMPLETED'.`);

    // 4. Testing Dead-Letter Queue (DLQ) Transition after Max Attempts Exceeded
    console.log("\n4. Testing Dead-Letter Queue (DLQ) Transition after Max Retries:");
    queueManager.registerHandler("TEST_PERMANENT_FAIL", async () => {
      throw new Error("Fatal unrecoverable API schema error 422");
    });

    const permFailJob = await queueManager.enqueue(
      "TEST_PERMANENT_FAIL",
      { corruptField: true },
      {
        maxAttempts: 2,
        backoffDelayMs: 50,
      }
    );

    // Attempt 1 -> fails, attempts=1
    await queueManager.processNext("dlq_worker");

    // Fast-forward backoff
    await prisma.backgroundJob.update({
      where: { id: permFailJob.id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });

    // Attempt 2 -> fails, attempts=2 >= maxAttempts -> DEAD_LETTER
    const dlqJob = await queueManager.processNext("dlq_worker");
    assert.ok(dlqJob);
    assert.strictEqual(dlqJob.id, permFailJob.id);
    assert.strictEqual(dlqJob.status, "DEAD_LETTER", "Job must transition to DEAD_LETTER");
    assert.strictEqual(dlqJob.attempts, 2);
    assert.ok(
      dlqJob.error?.includes("Fatal unrecoverable API schema error"),
      "DLQ must record root cause error"
    );
    assert.ok(dlqJob.stackTrace, "DLQ must record stack trace for diagnosis");
    console.log(`   ✓ Max retries exhausted: Job '${dlqJob.id}' transitioned to DEAD_LETTER queue.`);

    // 5. Testing DLQ Redrive / Replay Functionality
    console.log("\n5. Testing DLQ Redrive & Replay Functionality:");
    const redrivenJob = await queueManager.redriveJob(dlqJob.id);
    assert.strictEqual(redrivenJob.id, dlqJob.id);
    assert.strictEqual(redrivenJob.status, "QUEUED", "Redriven job must return to QUEUED status");
    assert.strictEqual(redrivenJob.attempts, 0, "Attempts counter must reset to 0");
    assert.strictEqual(redrivenJob.error, null, "Error must be cleared on redrive");
    assert.strictEqual(redrivenJob.stackTrace, null, "Stack trace must be cleared on redrive");
    console.log(`   ✓ DLQ Job successfully redriven to QUEUED status with reset attempts.`);

    // Clean up temporary redriven job
    await prisma.backgroundJob.delete({ where: { id: redrivenJob.id } });

    // 6. Testing Concurrent Batch Processing
    console.log("\n6. Testing Concurrent Batch Job Processing:");
    let batchCounter = 0;
    queueManager.registerHandler("TEST_BATCH_JOB", async (payload: any) => {
      batchCounter++;
      return { itemIndex: payload.index, processedAt: Date.now() };
    });

    const batchJobIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const bJob = await queueManager.enqueue("TEST_BATCH_JOB", { index: i }, { priority: i });
      batchJobIds.push(bJob.id);
    }

    const processedBatch = await queueManager.processBatch(4, 2, "batch_test_worker");
    assert.strictEqual(processedBatch.length, 4, "All 4 batch jobs must be processed");
    for (const b of processedBatch) {
      assert.strictEqual(b.status, "COMPLETED");
    }
    assert.strictEqual(batchCounter, 4, "Batch handler must execute exactly 4 times");
    console.log(`   ✓ Batch of 4 jobs concurrently processed with concurrency=2.`);

    // 7. Testing Cron Authorization Security
    console.log("\n7. Testing Cron Secret Authorization Verification:");
    const cronSecret = process.env.CRON_SECRET || "omnirank_cron_secret_internal_test";

    // Unauthorized without token
    const unauthReq = new Request("https://omnirank.tekora.io/api/v1/cron/gsc-sync", {
      method: "POST",
    });
    assert.strictEqual(verifyCronAuth(unauthReq), false, "Missing secret must be rejected");

    // Unauthorized with wrong token
    const wrongAuthReq = new Request("https://omnirank.tekora.io/api/v1/cron/gsc-sync", {
      method: "POST",
      headers: { authorization: "Bearer invalid_secret_token" },
    });
    assert.strictEqual(verifyCronAuth(wrongAuthReq), false, "Wrong token must be rejected");

    // Authorized via Bearer header
    const validBearerReq = new Request("https://omnirank.tekora.io/api/v1/cron/gsc-sync", {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    assert.strictEqual(verifyCronAuth(validBearerReq), true, "Valid Bearer header must be accepted");

    // Authorized via x-cron-secret header
    const validHeaderReq = new Request("https://omnirank.tekora.io/api/v1/cron/gsc-sync", {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });
    assert.strictEqual(verifyCronAuth(validHeaderReq), true, "Valid x-cron-secret must be accepted");

    // Authorized via query param
    const validQueryReq = new Request(
      `https://omnirank.tekora.io/api/v1/cron/gsc-sync?secret=${cronSecret}`,
      { method: "GET" }
    );
    assert.strictEqual(verifyCronAuth(validQueryReq), true, "Valid query param must be accepted");
    console.log("   ✓ Cron secret validation verified (Bearer, x-cron-secret, query param).");

    // 8. Testing Daily GSC Sync Scheduled Cron Runner
    console.log("\n8. Testing Daily GSC Sync Scheduled Cron Runner:");
    const gscCronResult = await runDailyGscSyncCron({
      drainQueue: true,
      forceMock: true,
    });

    assert.strictEqual(gscCronResult.cronName, "daily-gsc-sync");
    assert.strictEqual(gscCronResult.status, "SUCCESS");
    assert.ok(gscCronResult.itemsCount >= 1, "Must process at least 1 active project");
    assert.strictEqual(gscCronResult.errorsCount, 0);

    const gscAudit = await prisma.cronExecutionAudit.findFirst({
      where: { cronName: "daily-gsc-sync" },
      orderBy: { executedAt: "desc" },
    });
    assert.ok(gscAudit, "CronExecutionAudit record must be persisted");
    assert.strictEqual(gscAudit.status, "SUCCESS");
    console.log(`   ✓ Daily GSC Sync Cron executed successfully (Audit ID: ${gscAudit.id}).`);

    // 9. Testing Weekly Executive Digest Cron Runner
    console.log("\n9. Testing Weekly Executive Digest Scheduled Cron Runner:");
    const digestCronResult = await runWeeklyDigestCron({
      drainQueue: true,
      forceMock: true,
    });

    assert.strictEqual(digestCronResult.cronName, "weekly-digest");
    assert.strictEqual(digestCronResult.status, "SUCCESS");
    assert.ok(digestCronResult.itemsCount >= 1);

    const digestAudit = await prisma.cronExecutionAudit.findFirst({
      where: { cronName: "weekly-digest" },
      orderBy: { executedAt: "desc" },
    });
    assert.ok(digestAudit, "Weekly Digest CronExecutionAudit must be recorded");
    console.log(`   ✓ Weekly Digest Cron executed successfully (Audit ID: ${digestAudit.id}).`);

    // 10. Testing Monthly Quota Reset Cron Runner
    console.log("\n10. Testing Monthly Quota Reset Scheduled Cron Runner:");
    const quotaCronResult = await runMonthlyQuotaResetCron({
      drainQueue: true,
    });

    assert.strictEqual(quotaCronResult.cronName, "monthly-quota-reset");
    assert.strictEqual(quotaCronResult.status, "SUCCESS");
    assert.ok(quotaCronResult.itemsCount >= 1);

    const quotaAudit = await prisma.cronExecutionAudit.findFirst({
      where: { cronName: "monthly-quota-reset" },
      orderBy: { executedAt: "desc" },
    });
    assert.ok(quotaAudit, "Monthly Quota CronExecutionAudit must be recorded");
    console.log(`   ✓ Monthly Quota Reset Cron executed successfully (Audit ID: ${quotaAudit.id}).`);

    // 11. Testing Queue Stats Real-Time Metrics
    console.log("\n11. Testing Queue Stats Real-Time Aggregation:");
    const stats = await queueManager.getStats();
    assert.ok(typeof stats.queued === "number");
    assert.ok(typeof stats.completed === "number" && stats.completed >= 1);
    assert.ok(typeof stats.deadLetter === "number");
    assert.strictEqual(stats.total, stats.queued + stats.active + stats.completed + stats.failed + stats.deadLetter);
    console.log(`   ✓ Queue Stats verified: ${stats.completed} completed, ${stats.deadLetter} DLQ, total=${stats.total}.`);

    console.log("\n==================================================");
    console.log("🏆 ALL DISTRIBUTED QUEUE & CRON TESTS PASSED.");
    console.log("==================================================");
  } finally {
    // Teardown test fixtures
    console.log("\nCleaning up test fixtures from database...");
    if (testProjectId) {
      await prisma.rankedQuery.deleteMany({ where: { projectId: testProjectId } }).catch(() => {});
      await prisma.searchSnapshot.deleteMany({ where: { projectId: testProjectId } }).catch(() => {});
      await prisma.backgroundJob.deleteMany({ where: { projectId: testProjectId } }).catch(() => {});
      await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {});
    }

    // Clean up temporary test jobs
    await prisma.backgroundJob.deleteMany({
      where: {
        jobType: {
          in: ["TEST_FLAKY_JOB", "TEST_PERMANENT_FAIL", "TEST_BATCH_JOB"],
        },
      },
    }).catch(() => {});

    // Clean up test audits
    await prisma.cronExecutionAudit.deleteMany({
      where: {
        cronName: {
          in: ["daily-gsc-sync", "weekly-digest", "monthly-quota-reset"],
        },
      },
    }).catch(() => {});

    if (testWorkspaceId) {
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspaceId } }).catch(() => {});
      await prisma.workspace.delete({ where: { id: testWorkspaceId } }).catch(() => {});
    }

    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }

    console.log("✓ Fixtures successfully cleaned.");
  }
}

runDistributedQueueTests().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
