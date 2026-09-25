import assert from "node:assert";
import { prisma } from "../lib/prisma";
import {
  stageEnrichmentAction,
  updateEnrichmentStatus,
  listProjectEnrichments,
} from "../lib/ai/staging";

console.log("==================================================");
console.log("▶ RUNNING PHASE 3 EXIT CRITERIA VERIFICATION");
console.log("==================================================\n");

async function runPhase3ExitVerification() {
  const timestamp = Date.now();
  const testEmail = `architect-p3-${timestamp}@tekora.internal`;
  const workspaceSlug = `p3-ws-${timestamp}`;

  let createdUserId: string | null = null;
  let createdWorkspaceId: string | null = null;
  let createdProjectId: string | null = null;

  try {
    // 1. Setup Test Fixtures
    console.log("1. Setting up User, Workspace & Project fixtures:");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Phase 3 AI Architect",
      },
    });
    createdUserId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 3 AI Workspace",
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
        name: "OmniRank AI Staging Test Domain",
        siteUrl: "https://www.stagingtest.com",
        gscPropertyId: "sc-domain:stagingtest.com",
        deploymentMode: "AUTO_PR",
      },
    });
    createdProjectId = project.id;
    console.log(`   ✓ Workspace (${workspace.slug}) & Project (${project.name}) initialized in DB.`);

    // 2. Stage FAQ Enrichment Action
    console.log("\n2. Staging FAQ Schema & E-E-A-T Content Asset:");
    const faqAction = await stageEnrichmentAction(project.id, {
      queryText: "autonomous seo optimization tool",
      targetPageUrl: "https://www.stagingtest.com/autonomous-seo",
      type: "FAQ",
    });

    assert.ok(faqAction.id, "Must return valid action ID");
    assert.strictEqual(faqAction.status, "STAGED", "Initial status must be STAGED");
    assert.strictEqual(faqAction.generatedType, "FAQ");
    assert.deepStrictEqual(faqAction.triggerQueries, ["autonomous seo optimization tool"]);

    const faqPayload: any = faqAction.payload;
    assert.strictEqual(faqPayload.type, "FAQ");
    assert.ok(faqPayload.data.faqs.length >= 2, "Must contain generated FAQs");
    assert.strictEqual(faqPayload.data.jsonLdSchema["@type"], "FAQPage");
    console.log(
      `   ✓ Staged FAQ asset (${faqAction.id}) with Schema.org FAQPage JSON-LD in PostgreSQL.`
    );

    // 3. Stage Comparison Matrix Asset
    console.log("\n3. Staging Architectural Comparison Matrix Asset:");
    const comparisonAction = await stageEnrichmentAction(project.id, {
      queryText: "postgresql pgvector search setup",
      targetPageUrl: "https://www.stagingtest.com/pgvector-guide",
      type: "COMPARISON",
    });
    assert.strictEqual(comparisonAction.generatedType, "COMPARISON");
    const compPayload: any = comparisonAction.payload;
    assert.ok(compPayload.data.matrix.length >= 3);
    assert.ok(compPayload.data.markdownTable.includes("| Evaluation Dimension |"));
    console.log(`   ✓ Staged Comparison Matrix asset (${comparisonAction.id}) with Markdown table.`);

    // 4. Stage Code Snippet & Meta Tags
    console.log("\n4. Staging Code Snippet & Meta Tags Assets:");
    const codeAction = await stageEnrichmentAction(project.id, {
      queryText: "custom erp software developer kollam",
      type: "CODE_SNIPPET",
    });
    assert.strictEqual(codeAction.generatedType, "CODE_SNIPPET");

    const metaAction = await stageEnrichmentAction(project.id, {
      queryText: "enterprise nextjs 15 template dark mode",
      type: "META_TAGS",
    });
    assert.strictEqual(metaAction.generatedType, "META_TAGS");
    console.log("   ✓ Code Snippet and Meta Tags assets staged successfully.");

    // 5. Test Status Transitions & Decoupled Data Store Mutations
    console.log("\n5. Testing Staged Actions Status Workflow (STAGED -> APPROVED / REJECTED):");
    const approvedFaq = await updateEnrichmentStatus(faqAction.id, "APPROVED");
    assert.strictEqual(approvedFaq.status, "APPROVED", "Status must update to APPROVED");

    const rejectedCode = await updateEnrichmentStatus(codeAction.id, "REJECTED");
    assert.strictEqual(rejectedCode.status, "REJECTED", "Status must update to REJECTED");
    console.log("   ✓ Status transitions (STAGED -> APPROVED, STAGED -> REJECTED) verified.");

    // 6. Test Querying Staged Assets with Filters
    console.log("\n6. Testing Decoupled Store Querying & Filtering:");
    const approvedList = await listProjectEnrichments(project.id, { status: "APPROVED" });
    assert.strictEqual(approvedList.total, 1);
    assert.strictEqual(approvedList.items[0].id, faqAction.id);

    const stagedList = await listProjectEnrichments(project.id, { status: "STAGED" });
    assert.strictEqual(stagedList.total, 2); // comparison & meta

    const allList = await listProjectEnrichments(project.id);
    assert.strictEqual(allList.total, 4);
    console.log(
      `   ✓ Verified list filtering: 1 APPROVED, 2 STAGED, 1 REJECTED (Total: ${allList.total}).`
    );

    // 7. Test Deleting an Enrichment Action
    console.log("\n7. Testing Action Pruning & Deletion:");
    await prisma.enrichmentAction.delete({ where: { id: rejectedCode.id } });
    const afterDelete = await listProjectEnrichments(project.id);
    assert.strictEqual(afterDelete.total, 3);
    console.log("   ✓ Rejected action cleanly pruned.");

    console.log("\n==================================================");
    console.log("🏆 ALL PHASE 3 EXIT CRITERIA FULLY VERIFIED.");
    console.log("==================================================");
  } finally {
    // 8. Fixture Pruning
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

runPhase3ExitVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ PHASE 3 EXIT CRITERIA FAILED:", err);
    process.exit(1);
  });
