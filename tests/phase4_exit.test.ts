import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { stageEnrichmentAction, updateEnrichmentStatus } from "../lib/ai/staging";
import { deployEnrichmentToGit } from "../lib/deployment/git";
import { triggerAutomatedRollback } from "../lib/deployment/sandbox";
import { checkWorkspaceQuota, QuotaExceededError } from "../lib/billing/stripe";

console.log("==================================================");
console.log("▶ RUNNING PHASE 4 EXIT CRITERIA VERIFICATION");
console.log("==================================================\n");

async function runPhase4ExitVerification() {
  const timestamp = Date.now();
  const testEmail = `architect-p4-${timestamp}@tekora.internal`;
  const workspaceSlug = `p4-ws-${timestamp}`;

  let createdUserId: string | null = null;
  let createdWorkspaceId: string | null = null;
  let createdProjectId: string | null = null;

  try {
    // 1. Setup Fixtures
    console.log("1. Setting up User, Workspace & Project fixtures:");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Phase 4 Deployment Architect",
      },
    });
    createdUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 4 Deployment Workspace",
        slug: workspaceSlug,
        planTier: "STARTER",
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    createdWorkspaceId = workspace.id;

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "OmniRank Deployment Test Domain",
        siteUrl: "https://www.deploytest.com",
        gscPropertyId: "sc-domain:deploytest.com",
        deploymentMode: "AUTO_PR",
        githubRepo: "tekora/deploytest",
        githubBranch: "main",
      },
    });
    createdProjectId = project.id;
    console.log(`   ✓ Workspace (${workspace.slug}) & Project (${project.name}) provisioned in DB.`);

    // 2. Stage & Approve Enrichment
    console.log("\n2. Staging E-E-A-T asset for deployment pipeline:");
    const enrichment = await stageEnrichmentAction(project.id, {
      queryText: "autonomous git seo deployment engine",
      targetPageUrl: "https://www.deploytest.com/deployment",
      type: "FAQ",
    });
    await updateEnrichmentStatus(enrichment.id, "APPROVED");
    console.log(`   ✓ Asset staged and approved: ${enrichment.id}`);

    // 3. Execute Automated Git Deployment (PR Branching & Commit)
    console.log("\n3. Executing Build Sandbox Validation & Automated Git Deployment:");
    const deployResult = await deployEnrichmentToGit(enrichment.id, { forceMock: true });
    assert.strictEqual(deployResult.success, true, "Deployment must succeed");
    assert.ok(deployResult.prNumber && deployResult.prNumber > 0, "PR Number must be generated");
    assert.ok(deployResult.commitSha, "Commit SHA must be generated");
    assert.ok(deployResult.branchName?.startsWith("omnirank/enrich-"), "Branch name must follow convention");
    console.log(
      `   ✓ Deployment executed: PR #${deployResult.prNumber} opened on branch '${deployResult.branchName}' (Commit: ${deployResult.commitSha}).`
    );

    // Verify DB EnrichmentAction status updated to COMMITTED
    const dbEnrichment = await prisma.enrichmentAction.findUnique({
      where: { id: enrichment.id },
    });
    assert.ok(dbEnrichment);
    assert.strictEqual(dbEnrichment.status, "COMMITTED", "DB status must transition to COMMITTED");
    assert.strictEqual(dbEnrichment.gitPrNumber, deployResult.prNumber);
    assert.strictEqual(dbEnrichment.gitCommitSha, deployResult.commitSha);
    console.log("   ✓ Database record updated to COMMITTED with PR number and commit SHA.");

    // 4. Verify Immutable DeploymentAudit logs
    console.log("\n4. Verifying Immutable DeploymentAudit event log entries:");
    const audits = await prisma.deploymentAudit.findMany({
      where: { projectId: project.id },
      orderBy: { timestamp: "asc" },
    });
    assert.ok(audits.length >= 2, "Must record at least BUILD_PASSED and COMMIT_SUCCESS");
    assert.strictEqual(audits[0].event, "BUILD_PASSED");
    assert.strictEqual(audits[1].event, "COMMIT_SUCCESS");
    assert.strictEqual((audits[1].metadata as any)?.prNumber, deployResult.prNumber);
    console.log(`   ✓ Immutable audit entries verified: BUILD_PASSED, COMMIT_SUCCESS (Total: ${audits.length}).`);

    // 5. Test Automated Rollback Safety Net
    console.log("\n5. Testing Automated Rollback Trigger & Audit Logging:");
    const rolledBack = await triggerAutomatedRollback(
      enrichment.id,
      "Simulated production smoke test failure trigger"
    );
    assert.strictEqual(rolledBack.status, "ROLLED_BACK");

    const rollbackAudit = await prisma.deploymentAudit.findFirst({
      where: {
        projectId: project.id,
        event: "ROLLBACK_TRIGGERED",
      },
    });
    assert.ok(rollbackAudit, "ROLLBACK_TRIGGERED audit entry must exist");
    assert.strictEqual((rollbackAudit.metadata as any)?.prNumber, deployResult.prNumber);
    console.log("   ✓ Automated rollback successfully transitioned status to ROLLED_BACK with audit record.");

    // 6. Test Workspace Quota Enforcement
    console.log("\n6. Testing Workspace Subscription Tier Quotas:");
    // STARTER tier allows up to 3 projects
    const quotaCheck1 = await checkWorkspaceQuota(workspace.id, "CREATE_PROJECT");
    assert.strictEqual(quotaCheck1.allowed, true);

    // Downgrade workspace to FREE (limit: 1 project) to test rejection
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { planTier: "FREE" },
    });

    let quotaBlocked = false;
    try {
      await checkWorkspaceQuota(workspace.id, "CREATE_PROJECT");
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        quotaBlocked = true;
        assert.strictEqual(err.tier, "FREE");
        assert.strictEqual(err.quotaLimit, 1);
        assert.strictEqual(err.currentUsage, 1);
      }
    }
    assert.strictEqual(quotaBlocked, true, "Must throw QuotaExceededError when limit exceeded");
    console.log("   ✓ QuotaExceededError correctly thrown and enforced for workspace tier.");

    console.log("\n==================================================");
    console.log("🏆 ALL PHASE 4 EXIT CRITERIA FULLY VERIFIED.");
    console.log("==================================================");
  } finally {
    // 7. Cleanup Fixtures
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

runPhase4ExitVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ PHASE 4 EXIT CRITERIA FAILED:", err);
    process.exit(1);
  });
