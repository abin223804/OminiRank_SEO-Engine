import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { syncProjectSearchConsole } from "../lib/gsc/sync";
import { syncQueue } from "../lib/gsc/queue";

console.log("==================================================");
console.log("▶ RUNNING PHASE 2 EXIT CRITERIA VERIFICATION");
console.log("==================================================\n");

async function runPhase2ExitVerification() {
  const timestamp = Date.now();
  const testEmail = `architect-p2-${timestamp}@tekora.internal`;
  const workspaceSlug = `p2-ws-${timestamp}`;

  let createdUserId: string | null = null;
  let createdWorkspaceId: string | null = null;
  let createdProjectId: string | null = null;

  try {
    // 1. Create User
    console.log("1. Setting up User & Workspace fixtures:");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Phase 2 Verification Architect",
      },
    });
    createdUserId = user.id;
    console.log(`   ✓ User created: ${user.email} (${user.id})`);

    // 2. Create Workspace with user as OWNER
    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 2 Ingestion Workspace",
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
    createdWorkspaceId = workspace.id;
    console.log(`   ✓ Workspace created: ${workspace.slug} (${workspace.id})`);

    // 3. Create Project
    console.log("\n2. Provisioning tracking project:");
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "OmniRank Test Domain",
        siteUrl: "https://www.testdomain.com",
        gscPropertyId: "sc-domain:testdomain.com",
        deploymentMode: "AUTO_PR",
        gscAuthMethod: "SERVICE_ACCOUNT",
      },
    });
    createdProjectId = project.id;
    console.log(`   ✓ Project created: ${project.name} (${project.id})`);

    // 4. Run Initial Search Console Sync
    console.log("\n3. Executing Initial Search Console Ingestion & Striking Distance Classification:");
    const sync1 = await syncProjectSearchConsole(project.id, { forceMock: true });
    assert.ok(sync1.snapshotId, "Must return valid snapshotId");
    assert.ok(sync1.queriesCount > 0, "Must sync queries");
    assert.ok(sync1.strikingDistanceCount > 0, "Must identify striking distance queries");
    console.log(
      `   ✓ Snapshot 1 created (${sync1.snapshotId}): ${sync1.queriesCount} queries, ${sync1.strikingDistanceCount} striking-distance targets.`
    );

    // Verify DB snapshot
    const dbSnapshot1 = await prisma.searchSnapshot.findUnique({
      where: { id: sync1.snapshotId },
      include: { queries: true },
    });
    assert.ok(dbSnapshot1, "Snapshot 1 must exist in DB");
    assert.strictEqual(dbSnapshot1.projectId, project.id);
    assert.ok(dbSnapshot1.totalImpressions > 0, "Total impressions must be positive");
    assert.ok(dbSnapshot1.avgPosition > 0, "Average position must be positive");
    console.log("   ✓ Database snapshot persistence verified.");

    // Verify RankedQuery rows
    const strikingQueries = dbSnapshot1.queries.filter((q) => q.isStrikingDistance);
    assert.strictEqual(
      strikingQueries.length,
      sync1.strikingDistanceCount,
      "Striking distance query count in DB must match returned metric"
    );

    for (const sq of strikingQueries) {
      assert.ok(sq.position > 10.0 && sq.position <= 30.0, "Striking query position must be 11.0-30.0");
      assert.strictEqual(sq.positionDelta, null, "Initial sync queries must have null delta");
    }
    console.log("   ✓ Striking distance query boundary conditions verified in database rows.");

    // 5. Run Second Sync to Verify Delta Tracking Across Consecutive Snapshots
    console.log("\n4. Executing Consecutive Snapshot Ingestion for Position Delta Verification:");
    const sync2 = await syncProjectSearchConsole(project.id, { forceMock: true });
    assert.notStrictEqual(sync2.snapshotId, sync1.snapshotId, "Snapshot 2 must be distinct");

    const dbSnapshot2 = await prisma.searchSnapshot.findUnique({
      where: { id: sync2.snapshotId },
      include: { queries: true },
    });
    assert.ok(dbSnapshot2, "Snapshot 2 must exist in DB");

    // Check that queries in snapshot 2 computed deltas against snapshot 1
    const matchingQuery = dbSnapshot2.queries.find(
      (q) => q.query === "freelance software engineer kerala"
    );
    assert.ok(matchingQuery, "Query must exist in snapshot 2");
    // Since mock data positions are identical, delta should be 0.0
    assert.strictEqual(matchingQuery.positionDelta, 0.0, "Consecutive identical position must have 0.0 delta");
    console.log("   ✓ Cross-snapshot rank delta computation & persistence verified.");

    // 6. Test Background Queue Worker Execution
    console.log("\n5. Testing Asynchronous Background Queue Worker:");
    const job = syncQueue.enqueue(project.id, { forceMock: true });
    assert.ok(job.id.startsWith("gsc_sync_"), "Job ID format valid");
    console.log(`   ✓ Background job enqueued: ${job.id} (Status: ${job.status})`);

    // Wait for queue processing (should complete within a few hundred ms)
    let attempts = 0;
    while (job.status !== "completed" && job.status !== "failed" && attempts < 20) {
      await new Promise((res) => setTimeout(res, 100));
      attempts++;
    }

    assert.strictEqual(job.status, "completed", "Job must complete successfully");
    assert.ok(job.result?.snapshotId, "Job result must contain snapshotId");
    console.log(`   ✓ Background worker successfully processed job in ${job.completedAt! - job.startedAt!}ms.`);

    console.log("\n==================================================");
    console.log("🏆 ALL PHASE 2 EXIT CRITERIA FULLY VERIFIED.");
    console.log("==================================================");
  } finally {
    // 7. Cleanup fixtures
    console.log("\nCleaning up test fixtures from database...");
    if (createdProjectId) {
      await prisma.project.delete({ where: { id: createdProjectId } }).catch(() => {});
    }
    if (createdWorkspaceId) {
      await prisma.workspace.delete({ where: { id: createdWorkspaceId } }).catch(() => {});
    }
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    console.log("✓ Fixtures successfully pruned.");
  }
}

runPhase2ExitVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ PHASE 2 EXIT CRITERIA FAILED:", err);
    process.exit(1);
  });
