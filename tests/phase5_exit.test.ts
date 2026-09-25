import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { generateExecutiveDigest, sendExecutiveDigest } from "../lib/email/digest";
import { pingSitemap, notifyUrlIndexing, triggerPostDeploymentRecrawl } from "../lib/gsc/sitemap";

console.log("==================================================");
console.log("▶ RUNNING PHASE 5 EXIT CRITERIA VERIFICATION");
console.log("==================================================\n");

async function runPhase5ExitVerification() {
  const timestamp = Date.now();
  const testEmail = `architect-p5-${timestamp}@tekora.internal`;
  const workspaceSlug = `p5-ws-${timestamp}`;

  let createdUserId: string | null = null;
  let createdWorkspaceId: string | null = null;
  let createdProjectId: string | null = null;

  try {
    // 1. Setup Fixtures
    console.log("1. Setting up User, Workspace & Project fixtures:");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Phase 5 Launch Architect",
      },
    });
    createdUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 5 Executive Workspace",
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

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "OmniRank Executive Test Domain",
        siteUrl: "https://www.launchtest.com",
        gscPropertyId: "sc-domain:launchtest.com",
        deploymentMode: "AUTO_PR",
        githubRepo: "tekora/launchtest",
        githubBranch: "main",
      },
    });
    createdProjectId = project.id;
    console.log(`   ✓ Workspace (${workspace.slug}) & Project (${project.name}) created in DB.`);

    // 2. Populate Multi-Cycle Search Console Snapshots
    console.log("\n2. Populating historical Search Console snapshots & striking queries:");
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Snapshot 1 (Historical baseline)
    const snapshot1 = await prisma.searchSnapshot.create({
      data: {
        projectId: project.id,
        startDate: twoWeeksAgo,
        endDate: weekAgo,
        totalImpressions: 12500,
        totalClicks: 420,
        avgCtr: 0.0336,
        avgPosition: 22.8,
        totalQueries: 64,
        createdAt: weekAgo,
      },
    });

    await prisma.rankedQuery.createMany({
      data: [
        {
          projectId: project.id,
          snapshotId: snapshot1.id,
          query: "autonomous seo engine",
          pageUrl: "https://www.launchtest.com/engine",
          impressions: 1800,
          clicks: 65,
          ctr: 0.0361,
          position: 18.5,
          isStrikingDistance: true,
          positionDelta: null,
        },
        {
          projectId: project.id,
          snapshotId: snapshot1.id,
          query: "nextjs 15 schema optimization",
          pageUrl: "https://www.launchtest.com/schema",
          impressions: 1200,
          clicks: 42,
          ctr: 0.035,
          position: 24.1,
          isStrikingDistance: true,
          positionDelta: null,
        },
      ],
    });

    // Snapshot 2 (Current period with rank surge)
    const snapshot2 = await prisma.searchSnapshot.create({
      data: {
        projectId: project.id,
        startDate: weekAgo,
        endDate: now,
        totalImpressions: 17200,
        totalClicks: 680,
        avgCtr: 0.0395,
        avgPosition: 17.2,
        totalQueries: 82,
        createdAt: now,
      },
    });

    await prisma.rankedQuery.createMany({
      data: [
        {
          projectId: project.id,
          snapshotId: snapshot2.id,
          query: "autonomous seo engine",
          pageUrl: "https://www.launchtest.com/engine",
          impressions: 2600,
          clicks: 115,
          ctr: 0.0442,
          position: 13.8,
          isStrikingDistance: true,
          positionDelta: 4.7, // Surged 4.7 positions!
        },
        {
          projectId: project.id,
          snapshotId: snapshot2.id,
          query: "nextjs 15 schema optimization",
          pageUrl: "https://www.launchtest.com/schema",
          impressions: 1950,
          clicks: 78,
          ctr: 0.04,
          position: 18.2,
          isStrikingDistance: true,
          positionDelta: 5.9, // Surged 5.9 positions!
        },
        {
          projectId: project.id,
          snapshotId: snapshot2.id,
          query: "enterprise search console intelligence",
          pageUrl: "https://www.launchtest.com/intelligence",
          impressions: 1400,
          clicks: 52,
          ctr: 0.0371,
          position: 21.0,
          isStrikingDistance: true,
          positionDelta: 2.1,
        },
      ],
    });

    // Stage an enrichment for digest coverage
    const enrichment = await prisma.enrichmentAction.create({
      data: {
        projectId: project.id,
        targetPageUrl: "https://www.launchtest.com/engine",
        triggerQueries: ["autonomous seo engine"],
        generatedType: "FAQ",
        payload: { type: "FAQ", data: {} },
        status: "COMMITTED",
        gitPrNumber: 42,
        gitCommitSha: "a1b2c3d4e5f6",
      },
    });

    console.log("   ✓ 2 Consecutive snapshots and 5 ranked queries created with calculated deltas.");

    // 3. Verify Executive Email Digest Generation & KPI Deltas
    console.log("\n3. Testing Executive Search Intelligence Digest compilation:");
    const digestContent = await generateExecutiveDigest(project.id);

    assert.ok(digestContent.subject.includes(project.name), "Subject must include project name");
    assert.strictEqual(digestContent.data.projectName, project.name);
    assert.strictEqual(digestContent.data.kpis.impressions.current, 17200);
    assert.strictEqual(digestContent.data.kpis.impressions.previous, 12500);
    assert.strictEqual(digestContent.data.kpis.clicks.current, 680);
    assert.strictEqual(digestContent.data.kpis.clicks.previous, 420);
    assert.ok(digestContent.data.kpis.impressions.percentageChange > 30, "Impression growth delta verified");
    assert.ok(digestContent.data.kpis.clicks.percentageChange > 50, "Click growth delta verified");

    // Verify striking queries presence
    assert.ok(
      digestContent.data.strikingDistanceQueries.length >= 2,
      "Striking queries must be present in digest"
    );
    assert.strictEqual(digestContent.data.strikingDistanceQueries[0].query, "autonomous seo engine");

    // Verify HTML structure
    assert.ok(digestContent.html.includes("OmniRank Autonomous Intelligence"), "HTML must contain header badge");
    assert.ok(digestContent.html.includes("17,200"), "HTML must contain current impression count");
    assert.ok(digestContent.html.includes("PR #42"), "HTML must list committed PRs");
    assert.ok(digestContent.text.includes("OMNIRANK EXECUTIVE SEARCH INTELLIGENCE DIGEST"));
    console.log("   ✓ Executive Digest compiled with accurate week-over-week deltas and HTML email formatting.");

    // 4. Test Executive Digest Dispatch Engine
    console.log("\n4. Testing Executive Digest dispatch & audit logging:");
    const digestResult = await sendExecutiveDigest(project.id, {
      recipientEmails: ["stakeholder@launchtest.com", "growth@launchtest.com"],
      forceMock: true,
    });

    assert.strictEqual(digestResult.success, true);
    assert.strictEqual(digestResult.mock, true);
    assert.strictEqual(digestResult.recipients.length, 2);
    assert.ok(digestResult.messageId.startsWith("re_mock_"));
    assert.ok(digestResult.auditId, "Must create DeploymentAudit record");

    const digestAudit = await prisma.deploymentAudit.findFirst({
      where: {
        projectId: project.id,
        event: "DIGEST_SENT",
      },
    });
    assert.ok(digestAudit, "DIGEST_SENT audit log must exist");
    assert.strictEqual((digestAudit.metadata as any)?.messageId, digestResult.messageId);
    console.log(
      `   ✓ Digest dispatched to 2 recipients (Message ID: ${digestResult.messageId}) with immutable audit log.`
    );

    // 5. Test Google Sitemap Ping Utility
    console.log("\n5. Testing Google Search Console Sitemap Submission:");
    const sitemapResult = await pingSitemap(project.id, { forceMock: true });
    assert.strictEqual(sitemapResult.success, true);
    assert.strictEqual(sitemapResult.mock, true);
    assert.strictEqual(sitemapResult.statusCode, 200);
    assert.strictEqual(sitemapResult.sitemapUrl, "https://www.launchtest.com/sitemap.xml");
    console.log(`   ✓ Sitemap submitted: ${sitemapResult.sitemapUrl} (Status: ${sitemapResult.statusCode}).`);

    // 6. Test Google Indexing API URL Notification
    console.log("\n6. Testing Google Indexing API URL publishing:");
    const indexingUrls = [
      "https://www.launchtest.com/engine",
      "https://www.launchtest.com/schema",
    ];
    const indexingResult = await notifyUrlIndexing(project.id, indexingUrls, { forceMock: true });
    assert.strictEqual(indexingResult.success, true);
    assert.strictEqual(indexingResult.totalSuccess, 2);
    assert.strictEqual(indexingResult.notifiedUrls[0].status, "MOCKED");
    assert.strictEqual(indexingResult.notifiedUrls[0].type, "URL_UPDATED");
    console.log(`   ✓ Google Indexing API notified for ${indexingResult.totalSuccess} target URLs.`);

    // 7. Test Complete Post-Deployment Recrawl Trigger
    console.log("\n7. Testing complete post-deployment recrawl orchestration:");
    const recrawlResult = await triggerPostDeploymentRecrawl(
      project.id,
      ["https://www.launchtest.com/engine"],
      { forceMock: true }
    );
    assert.strictEqual(recrawlResult.success, true);
    assert.ok(recrawlResult.auditId, "Recrawl must create DeploymentAudit entry");

    const recrawlAudit = await prisma.deploymentAudit.findFirst({
      where: {
        projectId: project.id,
        event: "SITEMAP_PINGED",
      },
    });
    assert.ok(recrawlAudit, "SITEMAP_PINGED audit log must exist");
    console.log("   ✓ Post-deployment recrawl orchestrated with SITEMAP_PINGED audit log.");

    console.log("\n==================================================");
    console.log("🏆 ALL PHASE 5 EXIT CRITERIA FULLY VERIFIED.");
    console.log("==================================================");
  } finally {
    // 8. Cleanup Fixtures
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

runPhase5ExitVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ PHASE 5 EXIT CRITERIA FAILED:", err);
    process.exit(1);
  });
