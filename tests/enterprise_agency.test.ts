import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import {
  resolveWorkspaceByDomain,
  generateThemeCssVariables,
  updateWorkspaceBranding,
} from "../lib/agency/branding";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  formatSlackMessage,
  formatDiscordMessage,
  dispatchWorkspaceWebhooks,
} from "../lib/notifications/webhooks";
import { queueManager } from "../lib/queue/manager";
import { startWorkerDaemon, stopWorkerDaemon } from "../lib/queue/worker-runner";

async function runEnterpriseAgencyTests() {
  console.log("==================================================");
  console.log("▶ RUNNING ENTERPRISE AGENCY & SCALE TESTS");
  console.log("==================================================\n");

  const timestamp = Date.now();

  // 1. Agency White-Label Branding & Domain Resolution
  console.log("1. Testing Agency White-Label Branding & Domain Resolution:");
  const user = await prisma.user.create({
    data: {
      email: `agency-owner-${timestamp}@tekora.internal`,
      name: "Agency Managing Partner",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Apex Agency ${timestamp}`,
      slug: `apex-agency-${timestamp}`,
      planTier: "AGENCY",
      customDomain: `seo.apex-${timestamp}.com`,
      branding: {
        companyName: "Apex Digital Growth",
        logoUrl: "https://apex.com/logo.svg",
        primaryColor: "#8b5cf6", // Neon Violet
        accentColor: "#ec4899", // Pink
        customSenderEmail: "radar@apex.com",
      },
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  // Test Domain Resolution
  const resolved = await resolveWorkspaceByDomain(`https://seo.apex-${timestamp}.com/`);
  assert.ok(resolved !== null, "Workspace must resolve by custom domain");
  assert.strictEqual(resolved?.workspaceId, workspace.id);
  assert.strictEqual(resolved?.branding.companyName, "Apex Digital Growth");
  assert.strictEqual(resolved?.themeCssVars["--color-brand-primary"], "#8b5cf6");
  assert.strictEqual(resolved?.themeCssVars["--color-brand-accent"], "#ec4899");
  console.log(`   ✓ Resolved workspace by custom domain 'seo.apex-${timestamp}.com'.`);
  console.log(`   ✓ Dynamic CSS variables generated for brand colors (#8b5cf6 / #ec4899).`);

  // Test Branding Update
  await updateWorkspaceBranding(workspace.id, {
    branding: {
      companyName: "Apex Global SEO",
      primaryColor: "#06b6d4",
      accentColor: "#10b981",
    },
  });
  const updatedWs = await prisma.workspace.findUnique({ where: { id: workspace.id } });
  assert.strictEqual((updatedWs?.branding as any).companyName, "Apex Global SEO");
  console.log("   ✓ Agency branding settings updated successfully.");

  // 2. Outbound Webhook HMAC-SHA256 Signatures
  console.log("\n2. Testing Outbound Webhook HMAC-SHA256 Signatures:");
  const testPayload = JSON.stringify({
    event: "RANKING_DELTA_DETECTED",
    query: "autonomous seo engine",
    currentPosition: 12.4,
  });
  const webhookSecret = "whsec_super_secret_signing_key_42";

  const signature = signWebhookPayload(testPayload, webhookSecret);
  assert.ok(signature.length === 64, "HMAC-SHA256 hex string must be 64 characters");

  const isValid = verifyWebhookSignature(testPayload, signature, webhookSecret);
  assert.strictEqual(isValid, true, "Signature verification must succeed with matching secret");

  const isTampered = verifyWebhookSignature(testPayload + " ", signature, webhookSecret);
  assert.strictEqual(isTampered, false, "Tampered payload must fail signature verification");

  const isWrongSecret = verifyWebhookSignature(testPayload, signature, "wrong_secret");
  assert.strictEqual(isWrongSecret, false, "Wrong secret must fail signature verification");
  console.log("   ✓ HMAC-SHA256 payload signing and timing-safe verification verified.");

  // 3. Webhook Formatters: Slack and Discord
  console.log("\n3. Testing Slack & Discord Webhook Formatters:");
  const slackMsg = formatSlackMessage("RANKING_DELTA_DETECTED", {
    query: "autonomous seo engine",
    currentPosition: 12.4,
    delta: 3.5,
    pageUrl: "https://tekora.io/autonomous-seo",
    impressions: 5400,
    clicks: 410,
  });
  assert.strictEqual(slackMsg.blocks.length, 3);
  assert.ok(slackMsg.blocks[0].text.text.includes("Striking Distance Alert"));
  console.log("   ✓ Slack interactive blocks formatted correctly.");

  const discordMsg = formatDiscordMessage("PR_DEPLOYED", {
    query: "autonomous seo engine",
    branchName: "omnirank/enrich-123",
    prNumber: 42,
    targetUrl: "https://tekora.io/autonomous-seo",
  });
  assert.strictEqual(discordMsg.embeds.length, 1);
  assert.strictEqual(discordMsg.embeds[0].color, 0x10b981); // Emerald
  console.log("   ✓ Discord rich embed formatted with color mapping and field properties.");

  // 4. Database-Backed Outbound Webhooks Dispatch
  console.log("\n4. Testing Multi-Format Webhooks Dispatch from Database:");
  const genericSecretEnc = encryptSecret("sec_generic_12345");
  const slackSecretEnc = encryptSecret("sec_slack_12345");
  const discordSecretEnc = encryptSecret("sec_discord_12345");

  await prisma.webhookSubscription.createMany({
    data: [
      {
        workspaceId: workspace.id,
        url: "https://api.client.com/webhooks/omnirank",
        secretEnc: genericSecretEnc,
        events: ["RANKING_DELTA_DETECTED", "PR_DEPLOYED"],
        format: "GENERIC",
        isActive: true,
      },
      {
        workspaceId: workspace.id,
        url: "https://hooks.slack.com/services/mock/T00/B00/X00",
        secretEnc: slackSecretEnc,
        events: ["RANKING_DELTA_DETECTED"],
        format: "SLACK",
        isActive: true,
      },
      {
        workspaceId: workspace.id,
        url: "https://discord.com/api/webhooks/mock/123/xyz",
        secretEnc: discordSecretEnc,
        events: ["PR_DEPLOYED"],
        format: "DISCORD",
        isActive: true,
      },
    ],
  });

  const rankingResults = await dispatchWorkspaceWebhooks(
    workspace.id,
    "RANKING_DELTA_DETECTED",
    { query: "autonomous seo engine", currentPosition: 12.4, delta: 3.5 },
    { forceMock: true }
  );
  assert.strictEqual(rankingResults.length, 2, "Expected 2 active subscriptions for RANKING_DELTA_DETECTED");
  assert.ok(rankingResults.every((r) => r.success));
  console.log(`   ✓ Dispatched RANKING_DELTA_DETECTED to ${rankingResults.length} webhooks (Generic & Slack).`);

  const prResults = await dispatchWorkspaceWebhooks(
    workspace.id,
    "PR_DEPLOYED",
    { query: "autonomous seo engine", prNumber: 42 },
    { forceMock: true }
  );
  assert.strictEqual(prResults.length, 2, "Expected 2 active subscriptions for PR_DEPLOYED");
  assert.ok(prResults.every((r) => r.success));
  console.log(`   ✓ Dispatched PR_DEPLOYED to ${prResults.length} webhooks (Generic & Discord).`);

  // 5. Standalone Queue Worker Daemon Testing
  console.log("\n5. Testing Standalone High-Concurrency Worker Daemon:");
  // Enqueue test job
  const job = await queueManager.enqueue(
    "QUOTA_RESET",
    {
      workspaceId: workspace.id,
      month: "2026-09",
    },
    { priority: 10 }
  );
  assert.strictEqual(job.status, "QUEUED");
  console.log(`   ✓ Enqueued test job '${job.id}' (status=QUEUED, priority=10).`);

  // Start daemon with fast polling
  await startWorkerDaemon({
    workerId: `test_daemon_${timestamp}`,
    pollIntervalMs: 50,
    concurrency: 2,
    batchSize: 2,
  });

  // Wait brief period for daemon loop to process job
  await new Promise((resolve) => setTimeout(resolve, 350));

  // Check job status in DB
  const processedJob = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
  assert.strictEqual(processedJob?.status, "COMPLETED", "Daemon must process queued job to COMPLETED");
  console.log(`   ✓ Worker daemon successfully processed job '${job.id}' to COMPLETED.`);

  // Stop daemon
  await stopWorkerDaemon();
  console.log("   ✓ Worker daemon stopped gracefully.");

  // 6. Prune Test Fixtures
  console.log("\n6. Pruning test fixtures from database...");
  await prisma.webhookSubscription.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.backgroundJob.deleteMany({ where: { id: job.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("   ✓ Test fixtures safely pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL ENTERPRISE AGENCY & SCALE TESTS PASSED.");
  console.log("==================================================");
}

runEnterpriseAgencyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
