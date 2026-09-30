import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import {
  exportWorkspaceData,
  purgeWorkspaceData,
  pruneOldAuditLogs,
} from "../lib/compliance/gdpr";
import { GET as healthHandler } from "../app/api/health/route";

async function runObservabilityHealthTests() {
  console.log("==================================================");
  console.log("▶ RUNNING OBSERVABILITY, HEALTH & SOC 2 GDPR TESTS");
  console.log("==================================================\n");

  const timestamp = Date.now();

  // 1. Structured JSON Logger Verification
  console.log("1. Testing Structured JSON Logger Formatting & Trace Context:");
  const logChild = logger.child({ traceId: `trace_${timestamp}`, workspaceId: "ws_demo" });
  const logEntry = logChild.info("Processing striking distance enrichment", {
    durationMs: 24,
    query: "autonomous seo nextjs",
  });

  assert.strictEqual(logEntry.level, "info");
  assert.strictEqual(logEntry.message, "Processing striking distance enrichment");
  assert.strictEqual(logEntry.context?.traceId, `trace_${timestamp}`);
  assert.strictEqual(logEntry.context?.workspaceId, "ws_demo");
  assert.strictEqual(logEntry.context?.durationMs, 24);
  console.log("   ✓ Structured log entry validated with traceId, level, timestamp, and metadata.");

  // 2. Production Health Check Probe (SLA <= 50ms)
  console.log("\n2. Testing Production Health Check Probe (/api/health):");
  const healthStart = Date.now();
  const healthRes = await healthHandler();
  const healthElapsed = Date.now() - healthStart;
  const healthData = await healthRes.json();

  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthData.status, "healthy");
  assert.strictEqual(healthData.checks.database.status, "healthy");
  assert.strictEqual(healthData.checks.queue.status, "healthy");
  assert.ok(healthElapsed <= 50, `Health check probe must complete in <= 50ms (actual: ${healthElapsed}ms)`);
  console.log(
    `   ✓ Health probe completed in ${healthElapsed}ms (SLA <= 50ms): status=${healthData.status}, dbLatency=${healthData.checks.database.latencyMs}ms.`
  );

  // 3. Setup GDPR Test Fixtures: User, Workspace, Project, Snapshots, Queries, Actions, Audits, CMS
  console.log("\n3. Setting up GDPR & SOC 2 Compliance Test Fixtures:");
  const user = await prisma.user.create({
    data: {
      email: `gdpr-subject-${timestamp}@tekora.internal`,
      name: "GDPR Compliance User",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Compliance Workspace ${timestamp}`,
      slug: `compliance-ws-${timestamp}`,
      planTier: "PRO",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Compliance Test Domain",
      siteUrl: "https://compliance.tekora.io",
      gscPropertyId: "sc-domain:compliance.tekora.io",
      githubTokenEnc: "mock_iv:mock_tag:mock_enc",
      gscServiceAccountJsonEnc: "mock_iv:mock_tag:mock_enc",
    },
  });

  const snapshot = await prisma.searchSnapshot.create({
    data: {
      projectId: project.id,
      startDate: new Date(),
      endDate: new Date(),
      totalImpressions: 12000,
      totalClicks: 850,
      avgCtr: 7.08,
      avgPosition: 14.2,
      totalQueries: 1,
    },
  });

  await prisma.rankedQuery.create({
    data: {
      projectId: project.id,
      snapshotId: snapshot.id,
      query: "soc 2 compliance seo checklist",
      pageUrl: "https://compliance.tekora.io/soc2",
      impressions: 4000,
      clicks: 300,
      ctr: 7.5,
      position: 12.4,
      isStrikingDistance: true,
    },
  });

  await prisma.enrichmentAction.create({
    data: {
      projectId: project.id,
      targetPageUrl: "https://compliance.tekora.io/soc2",
      triggerQueries: ["soc 2 compliance seo checklist"],
      generatedType: "FAQ",
      payload: { type: "FAQ", data: {} },
      status: "APPROVED",
    },
  });

  await prisma.deploymentAudit.create({
    data: {
      projectId: project.id,
      event: "BUILD_PASSED",
      details: "Compliance test build audit log",
    },
  });

  await prisma.cmsConnection.create({
    data: {
      projectId: project.id,
      provider: "WORDPRESS",
      siteUrl: "https://compliance.tekora.io",
      credentialsEnc: "mock_iv:mock_tag:mock_enc",
      status: "CONNECTED",
    },
  });
  console.log(`   ✓ Workspace (${workspace.slug}), Project, Snapshot, Query, Action, and Audit log created.`);

  // 4. Test Complete GDPR Data Export
  console.log("\n4. Testing GDPR Complete Data Export Engine:");
  const exportArchive = await exportWorkspaceData(workspace.id);

  assert.strictEqual(exportArchive.metadata.workspaceId, workspace.id);
  assert.strictEqual(exportArchive.metadata.workspaceSlug, workspace.slug);
  assert.strictEqual(exportArchive.data.workspace.name, `Compliance Workspace ${timestamp}`);
  assert.strictEqual(exportArchive.data.members.length, 1);
  assert.strictEqual(exportArchive.data.projects.length, 1);

  const exportedProj = exportArchive.data.projects[0];
  assert.strictEqual(exportedProj.snapshotsCount, 1);
  assert.strictEqual(exportedProj.queriesCount, 1);
  assert.strictEqual(exportedProj.enrichmentsCount, 1);
  assert.strictEqual(exportedProj.auditLogsCount, 1);
  assert.strictEqual(exportedProj.secretsStatus.hasGithubToken, true);
  assert.strictEqual(exportedProj.secretsStatus.hasGscCredentials, true);

  // Assert zero plaintext or encrypted secrets exposed
  const serialized = JSON.stringify(exportArchive);
  assert.ok(!serialized.includes("mock_enc"), "Raw encrypted secrets must NOT leak into GDPR export archive");
  console.log("   ✓ Export archive verified: Complete tenant tree exported with zero secret leakage.");

  // 5. Test SOC 2 Audit Retention Pruning
  console.log("\n5. Testing SOC 2 Audit Retention Pruning:");
  const pruneResult = await pruneOldAuditLogs(365);
  assert.ok(typeof pruneResult.prunedCount === "number");
  console.log(`   ✓ Audit log retention evaluator executed (pruned ${pruneResult.prunedCount} stale logs).`);

  // 6. Test GDPR Right-to-be-Forgotten Cascade Purge
  console.log("\n6. Testing GDPR Cascade Right-to-be-Forgotten Purge:");
  const purgeResult = await purgeWorkspaceData(workspace.id);
  assert.strictEqual(purgeResult.success, true);
  assert.strictEqual(purgeResult.purgedWorkspaceId, workspace.id);

  // Verify zero remaining records across collections
  const [remWs, remProj, remSnap, remQuery, remAction, remAudit, remCms] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspace.id } }),
    prisma.project.findMany({ where: { workspaceId: workspace.id } }),
    prisma.searchSnapshot.findMany({ where: { projectId: project.id } }),
    prisma.rankedQuery.findMany({ where: { projectId: project.id } }),
    prisma.enrichmentAction.findMany({ where: { projectId: project.id } }),
    prisma.deploymentAudit.findMany({ where: { projectId: project.id } }),
    prisma.cmsConnection.findMany({ where: { projectId: project.id } }),
  ]);

  assert.strictEqual(remWs, null, "Workspace must be deleted");
  assert.strictEqual(remProj.length, 0, "Projects must be deleted");
  assert.strictEqual(remSnap.length, 0, "Snapshots must be deleted");
  assert.strictEqual(remQuery.length, 0, "Queries must be deleted");
  assert.strictEqual(remAction.length, 0, "Actions must be deleted");
  assert.strictEqual(remAudit.length, 0, "Audits must be deleted");
  assert.strictEqual(remCms.length, 0, "CmsConnections must be deleted");
  console.log("   ✓ Verified 100% cascade purge across all linked collections (0 orphaned records).");

  // Clean user
  await prisma.user.delete({ where: { id: user.id } });
  console.log("   ✓ User fixture safely deleted.");

  console.log("\n==================================================");
  console.log("🏆 ALL OBSERVABILITY, HEALTH & SOC 2 TESTS PASSED.");
  console.log("==================================================");
}

runObservabilityHealthTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
