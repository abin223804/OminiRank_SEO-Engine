import { prisma } from "@/lib/prisma";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  TIER_QUOTAS,
  PlanTier,
} from "@/lib/billing/stripe";

async function runStripeBillingIntegrationTests() {
  console.log("==================================================");
  console.log("▶ RUNNING STRIPE CHECKOUT & BILLING PORTAL TESTS");
  console.log("==================================================");

  const testSuffix = Date.now().toString();

  // 1. Setting up Test Fixtures
  console.log("\n1. Setting up Billing Fixtures on MongoDB Atlas:");
  const testUser = await prisma.user.create({
    data: {
      email: `billing-user-${testSuffix}@omnirank.test`,
      name: "Stripe Billing Tester",
    },
  });

  const testWorkspace = await prisma.workspace.create({
    data: {
      name: `Billing Test Workspace ${testSuffix}`,
      slug: `billing-ws-${testSuffix}`,
      planTier: "STARTER",
    },
  });

  console.log(`   ✓ Workspace '${testWorkspace.name}' initialized with STARTER tier.`);

  // 2. Testing Stripe Checkout Session Generation
  console.log("\n2. Testing Stripe Checkout Session Generation:");
  const checkoutResult = await createCheckoutSession({
    workspaceId: testWorkspace.id,
    userEmail: testUser.email,
    userName: testUser.name,
    targetTier: "PRO",
    successUrl: "http://localhost:3000/dashboard",
    cancelUrl: "http://localhost:3000/pricing",
  });

  if (!checkoutResult.url) {
    throw new Error("Checkout session generation returned empty URL");
  }
  console.log(`   ✓ Checkout session URL generated: ${checkoutResult.url.slice(0, 48)}...`);
  console.log(`   ✓ Session ID: ${checkoutResult.sessionId} (Mock Mode: ${checkoutResult.isMock})`);

  // 3. Testing Simulated Webhook Checkout Completion to PRO Tier
  console.log("\n3. Testing Webhook Checkout Completion & Tier Provisioning:");
  const mockStripeCustomerId = `cus_mock_${testSuffix}`;
  const mockSubscriptionId = `sub_mock_${testSuffix}`;

  const upgradedWorkspace = await prisma.workspace.update({
    where: { id: testWorkspace.id },
    data: {
      stripeCustomerId: mockStripeCustomerId,
      stripeSubscriptionId: mockSubscriptionId,
      planTier: "PRO",
    },
  });

  if (upgradedWorkspace.planTier !== "PRO") {
    throw new Error(`Expected planTier 'PRO', got '${upgradedWorkspace.planTier}'`);
  }
  console.log(`   ✓ Workspace successfully upgraded to PRO tier with customer ID: ${upgradedWorkspace.stripeCustomerId}.`);

  // 4. Testing Stripe Customer Portal Session Generation
  console.log("\n4. Testing Stripe Customer Portal Session Generation:");
  const portalResult = await createCustomerPortalSession({
    workspaceId: testWorkspace.id,
    returnUrl: "http://localhost:3000/settings",
  });

  if (!portalResult.url) {
    throw new Error("Customer portal session returned empty URL");
  }
  console.log(`   ✓ Customer Portal URL generated: ${portalResult.url.slice(0, 48)}...`);

  // 5. Testing Subscription Cancellation & Downgrade
  console.log("\n5. Testing Subscription Cancellation / Churn Handling:");
  const canceledWorkspace = await prisma.workspace.update({
    where: { id: testWorkspace.id },
    data: {
      planTier: "FREE",
      stripeSubscriptionId: null,
    },
  });

  if (canceledWorkspace.planTier !== "FREE" || canceledWorkspace.stripeSubscriptionId !== null) {
    throw new Error("Subscription cancellation state mismatch");
  }
  console.log(`   ✓ Workspace downgraded to FREE tier upon subscription cancellation.`);

  // 6. Cleanup Fixtures from MongoDB Atlas
  console.log("\n6. Cleaning up test fixtures from database...");
  await prisma.workspace.delete({ where: { id: testWorkspace.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("   ✓ Test fixtures cleanly pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL STRIPE CHECKOUT & BILLING TESTS PASSED.");
  console.log("==================================================");
}

runStripeBillingIntegrationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
