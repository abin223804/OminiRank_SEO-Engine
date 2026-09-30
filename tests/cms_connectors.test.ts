import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import {
  buildGitHubAppManifest,
  signGitHubAppJwt,
  getInstallationAccessToken,
  deployToGitHubApp,
} from "../lib/cms/github-app";
import {
  buildWordPressContentPayload,
  deployToWordPress,
} from "../lib/cms/wordpress";
import { deployToWebflow } from "../lib/cms/webflow";
import { deployEnrichmentToCms } from "../lib/cms/dispatcher";

async function runCmsConnectorsTests() {
  console.log("==================================================");
  console.log("▶ RUNNING HEADLESS CMS & GITHUB APP CONNECTOR TESTS");
  console.log("==================================================\n");

  const timestamp = Date.now();

  // 1. Testing GitHub App Manifest generation & JWT assertion
  console.log("1. Testing GitHub App Manifest Builder & Token Signing:");
  const manifest = buildGitHubAppManifest({
    appName: "OmniRank-Test-App",
    redirectUrl: "https://omnirank.tekora.io/callback",
  });
  assert.strictEqual(manifest.name, "OmniRank-Test-App");
  assert.strictEqual(manifest.default_permissions.pull_requests, "write");
  assert.strictEqual(manifest.default_permissions.contents, "write");
  console.log("   ✓ GitHub App Manifest pre-configured with required permissions.");

  const jwt = signGitHubAppJwt("123456", "MOCK_PRIVATE_KEY");
  assert.ok(jwt.split(".").length === 3, "JWT must be valid 3-part format");
  console.log("   ✓ RS256 JWT assertion successfully generated.");

  const installToken = await getInstallationAccessToken("install_789", "123456", "MOCK_PRIVATE_KEY", true);
  assert.ok(installToken.startsWith("ghs_mock_token_"), "Installation token generated");
  console.log("   ✓ GitHub App installation token successfully minted.");

  // 2. Testing WordPress Payload Builder (RankMath, Yoast, ACF)
  console.log("\n2. Testing WordPress Payload Builder & Schema.org Mappings:");
  const testFaqPayload = {
    type: "FAQ",
    data: {
      faqs: [
        {
          question: "What is Next.js ISR?",
          answerPlain: "Incremental Static Regeneration.",
          answerHtml: "<p>Incremental Static Regeneration.</p>",
        },
        {
          question: "How does OmniRank optimize it?",
          answerPlain: "Autonomous PRs.",
          answerHtml: "<p>Autonomous PRs.</p>",
        },
      ],
      jsonLdSchema: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Next.js ISR?",
            acceptedAnswer: { "@type": "Answer", text: "Incremental Static Regeneration." },
          },
        ],
      },
    },
  };

  const rankMathResult = buildWordPressContentPayload("FAQ", testFaqPayload, "RANK_MATH");
  assert.ok(rankMathResult.contentHtml.includes("omnirank-faq-section"));
  assert.ok(rankMathResult.meta.rank_math_schema.includes("FAQPage"));
  console.log("   ✓ RankMath schema.org JSON-LD mapped to meta.rank_math_schema.");

  const yoastResult = buildWordPressContentPayload("FAQ", testFaqPayload, "YOAST");
  assert.strictEqual(yoastResult.meta._yoast_wpseo_schema_page_type, "FAQPage");
  assert.strictEqual(yoastResult.meta._yoast_wpseo_faq.length, 2);
  console.log("   ✓ Yoast SEO metadata mapped with FAQPage type and entries.");

  const acfResult = buildWordPressContentPayload("FAQ", testFaqPayload, "ACF");
  assert.strictEqual(acfResult.meta.acf_faq_repeater.length, 2);
  console.log("   ✓ Advanced Custom Fields (ACF) repeater mapped.");

  // 3. Database Fixtures Setup: Workspace, Project, EnrichmentAction, CmsConnections
  console.log("\n3. Setting up Database Fixtures in MongoDB:");
  const testUser = await prisma.user.create({
    data: {
      email: `cms-architect-${timestamp}@tekora.internal`,
      name: "CMS Test Architect",
    },
  });

  const testWorkspace = await prisma.workspace.create({
    data: {
      name: `CMS Test Workspace ${timestamp}`,
      slug: `cms-ws-${timestamp}`,
      members: {
        create: {
          userId: testUser.id,
          role: "OWNER",
        },
      },
    },
  });

  const testProject = await prisma.project.create({
    data: {
      workspaceId: testWorkspace.id,
      name: "OmniRank Multi-CMS Project",
      siteUrl: "https://cms-demo.tekora.io",
      gscPropertyId: "sc-domain:cms-demo.tekora.io",
    },
  });

  // Create Staged Action for testing
  const stagedAction = await prisma.enrichmentAction.create({
    data: {
      projectId: testProject.id,
      targetPageUrl: "https://cms-demo.tekora.io/blog/nextjs-seo",
      triggerQueries: ["nextjs seo optimization"],
      generatedType: "FAQ",
      payload: testFaqPayload,
      status: "APPROVED",
    },
  });

  console.log(`   ✓ Workspace (${testWorkspace.slug}), Project (${testProject.id}), and Staged Action provisioned.`);

  // 4. AES-256-GCM Verification for CMS Credentials
  console.log("\n4. Testing AES-256-GCM Encryption for Stored CMS Credentials:");
  const ghCredsEnc = encryptSecret(
    JSON.stringify({
      appId: "app_999",
      clientId: "client_999",
      clientSecret: "sec_999",
      privateKeyPem: "MOCK_PRIVATE_KEY",
      installationId: "inst_123",
    })
  );
  const wpCredsEnc = encryptSecret(
    JSON.stringify({
      siteUrl: "https://wordpress.demo.local",
      username: "admin_seo",
      applicationPassword: "mock_app_pass_abcd_1234",
      pluginType: "RANK_MATH",
    })
  );
  const wfCredsEnc = encryptSecret(
    JSON.stringify({
      siteId: "wf_site_999",
      accessToken: "mock_wf_token_xyz",
      collectionId: "wf_col_posts",
    })
  );

  // Decrypt check
  assert.strictEqual(JSON.parse(decryptSecret(ghCredsEnc)).appId, "app_999");
  assert.strictEqual(JSON.parse(decryptSecret(wpCredsEnc)).username, "admin_seo");
  assert.strictEqual(JSON.parse(decryptSecret(wfCredsEnc)).siteId, "wf_site_999");
  console.log("   ✓ All credentials cleanly encrypted and verified via authenticated AES-256-GCM.");

  // 5. Register CMS Connections in MongoDB
  const ghConn = await prisma.cmsConnection.create({
    data: {
      projectId: testProject.id,
      provider: "GITHUB_APP",
      siteUrl: "https://github.com/tekora/omnirank-demo",
      credentialsEnc: ghCredsEnc,
      metadata: { repo: "tekora/omnirank-demo" },
      status: "CONNECTED",
    },
  });

  const wpConn = await prisma.cmsConnection.create({
    data: {
      projectId: testProject.id,
      provider: "WORDPRESS",
      siteUrl: "https://wordpress.demo.local",
      credentialsEnc: wpCredsEnc,
      metadata: { pluginType: "RANK_MATH", postId: 42 },
      status: "CONNECTED",
    },
  });

  const wfConn = await prisma.cmsConnection.create({
    data: {
      projectId: testProject.id,
      provider: "WEBFLOW",
      siteUrl: "https://webflow.com/dashboard/sites/wf_site_999",
      credentialsEnc: wfCredsEnc,
      metadata: { collectionId: "wf_col_posts", itemId: "item_42" },
      status: "CONNECTED",
    },
  });
  console.log("   ✓ GitHub App, WordPress, and Webflow connections persisted in MongoDB.");

  // 6. Test End-to-End CMS Dispatcher for GitHub App
  console.log("\n5. Testing End-to-End Dispatcher -> GitHub App:");
  const ghDeploy = await deployEnrichmentToCms(stagedAction.id, ghConn.id, { forceMock: true });
  assert.strictEqual(ghDeploy.success, true);
  assert.strictEqual(ghDeploy.provider, "GITHUB_APP");
  assert.ok(typeof ghDeploy.externalId === "number", "PR number returned");
  console.log(`   ✓ GitHub App PR #${ghDeploy.externalId} created with status COMMITTED.`);

  // Verify status in DB
  const updatedAction1 = await prisma.enrichmentAction.findUnique({ where: { id: stagedAction.id } });
  assert.strictEqual(updatedAction1?.status, "COMMITTED");

  // 7. Test End-to-End CMS Dispatcher for WordPress
  console.log("\n6. Testing End-to-End Dispatcher -> WordPress (RankMath):");
  const wpDeploy = await deployEnrichmentToCms(stagedAction.id, wpConn.id, { forceMock: true });
  assert.strictEqual(wpDeploy.success, true);
  assert.strictEqual(wpDeploy.provider, "WORDPRESS");
  assert.strictEqual(wpDeploy.externalId, 42);
  console.log(`   ✓ WordPress post #${wpDeploy.externalId} synced with Schema.org JSON-LD.`);

  // 8. Test End-to-End CMS Dispatcher for Webflow
  console.log("\n7. Testing End-to-End Dispatcher -> Webflow CMS v2:");
  const wfDeploy = await deployEnrichmentToCms(stagedAction.id, wfConn.id, { forceMock: true });
  assert.strictEqual(wfDeploy.success, true);
  assert.strictEqual(wfDeploy.provider, "WEBFLOW");
  assert.strictEqual(wfDeploy.externalId, "item_42");
  console.log(`   ✓ Webflow collection item '${wfDeploy.externalId}' patched with schema embed.`);

  // 9. Verify Immutable DeploymentAudit records
  console.log("\n8. Verifying Immutable DeploymentAudit Trail:");
  const audits = await prisma.deploymentAudit.findMany({
    where: { projectId: testProject.id },
  });
  const cmsSuccessAudits = audits.filter((a) => a.event === "CMS_DEPLOY_SUCCESS");
  assert.strictEqual(cmsSuccessAudits.length, 3, "Expected 3 CMS_DEPLOY_SUCCESS audit logs");
  console.log(`   ✓ Verified 3 CMS_DEPLOY_SUCCESS audit records in MongoDB.`);

  // 10. Clean up test fixtures
  console.log("\n9. Pruning test fixtures from database...");
  await prisma.workspace.delete({ where: { id: testWorkspace.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("   ✓ Test fixtures safely pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL HEADLESS CMS & GITHUB APP TESTS PASSED.");
  console.log("==================================================");
}

runCmsConnectorsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
