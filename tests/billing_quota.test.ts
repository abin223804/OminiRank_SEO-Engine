import assert from "node:assert";
import crypto from "node:crypto";
import {
  TIER_QUOTAS,
  verifyStripeSignature,
  resolveTierFromPriceId,
} from "../lib/billing/stripe";

console.log("==================================================");
console.log("▶ RUNNING STRIPE BILLING & QUOTA VERIFICATION TESTS");
console.log("==================================================\n");

// 1. Quota Definitions
console.log("1. Testing Workspace Tier Quota Definitions:");
assert.strictEqual(TIER_QUOTAS.FREE.maxProjects, 1);
assert.strictEqual(TIER_QUOTAS.FREE.maxEnrichmentsPerMonth, 3);

assert.strictEqual(TIER_QUOTAS.STARTER.maxProjects, 3);
assert.strictEqual(TIER_QUOTAS.STARTER.maxEnrichmentsPerMonth, 25);

assert.strictEqual(TIER_QUOTAS.PRO.maxProjects, 10);
assert.strictEqual(TIER_QUOTAS.PRO.maxEnrichmentsPerMonth, 150);

assert.ok(TIER_QUOTAS.AGENCY.maxProjects >= 1000);
console.log("   ✓ Tier quotas (FREE, STARTER, PRO, AGENCY) verified.");

// 2. Stripe Webhook Signature Verification
console.log("\n2. Testing Stripe HMAC-SHA256 Signature Verification:");
const webhookSecret = "whsec_test_secret_key_12345";
const rawPayload = JSON.stringify({
  id: "evt_test_123",
  type: "checkout.session.completed",
  created: Math.floor(Date.now() / 1000),
});
const timestamp = Math.floor(Date.now() / 1000).toString();

// Generate genuine Stripe HMAC signature
const signedPayload = `${timestamp}.${rawPayload}`;
const validSignature = crypto
  .createHmac("sha256", webhookSecret)
  .update(signedPayload, "utf8")
  .digest("hex");

const signatureHeader = `t=${timestamp},v1=${validSignature}`;

// Test authentic signature
const isAuthentic = verifyStripeSignature(rawPayload, signatureHeader, webhookSecret);
assert.strictEqual(isAuthentic, true, "Authentic Stripe webhook signature must be accepted");
console.log("   ✓ Authentic Stripe webhook signature accepted.");

// Test tampered payload
const tamperedPayload = rawPayload.replace("evt_test_123", "evt_attacker_666");
const isTamperedAccepted = verifyStripeSignature(tamperedPayload, signatureHeader, webhookSecret);
assert.strictEqual(isTamperedAccepted, false, "Tampered payload must be rejected");
console.log("   ✓ Tampered payload signature rejected.");

// Test wrong secret
const isWrongSecretAccepted = verifyStripeSignature(rawPayload, signatureHeader, "whsec_wrong_key");
assert.strictEqual(isWrongSecretAccepted, false, "Signature with wrong secret must be rejected");
console.log("   ✓ Mismatched webhook secret rejected.");

// 3. Price ID mapping
console.log("\n3. Testing Price ID to Plan Tier Resolution:");
process.env.STRIPE_PRO_PRICE_ID = "price_pro_monthly_149";
process.env.STRIPE_AGENCY_PRICE_ID = "price_agency_monthly_499";

assert.strictEqual(resolveTierFromPriceId("price_pro_monthly_149"), "PRO");
assert.strictEqual(resolveTierFromPriceId("price_agency_monthly_499"), "AGENCY");
assert.strictEqual(resolveTierFromPriceId("unknown_id"), "STARTER");
console.log("   ✓ Plan tier resolution from Stripe Price ID verified.");

console.log("\n==================================================");
console.log("✅ ALL STRIPE BILLING & QUOTA TESTS PASSED.");
console.log("==================================================");
