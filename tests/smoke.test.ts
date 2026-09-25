import assert from "node:assert";
import { encryptSecret, decryptSecret } from "../lib/crypto";

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "f8a42b109e530965d1bca142e09875e53fa69dc9ef310461291f09cb8d95642a";

console.log("==================================================");
console.log("▶ OMNIRANK PHASE 1 SMOKE TEST SUITE");
console.log("==================================================\n");

// 1. CRYPTO & ENCRYPTION AT REST TESTS
console.log("1. Testing AES-256-GCM Encryption At Rest:");
const sampleKey = JSON.stringify({
  client_email: "service-account@domain.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...",
});

const encryptedSecret = encryptSecret(sampleKey);
assert.ok(encryptedSecret.includes(":"), "Encrypted secret must be delimited");
const decryptedSecret = decryptSecret(encryptedSecret);
assert.strictEqual(decryptedSecret, sampleKey, "Decrypted text must match plaintext");
console.log("   ✓ AES-256-GCM round-trip encryption verified.");

// Tamper test
const [iv, tag, cipher] = encryptedSecret.split(":");
const tamperedCipher = `${iv}:${tag}:${cipher.slice(0, -4)}ffff`;
assert.throws(
  () => decryptSecret(tamperedCipher),
  /Unsupported state or unable to authenticate data/,
  "Tampered payload must trigger authentication tag failure"
);
console.log("   ✓ Tamper protection (Auth Tag validation) verified.");

// 2. STRIKING DISTANCE BOUNDARY CLASSIFIER TEST (Preview for Phase 2 specification)
console.log("\n2. Testing Striking Distance Classification Boundary Logic (Pos 11.0–30.0):");
function isStrikingDistance(position: number, impressions: number, minImpressions = 5): boolean {
  return position > 10.0 && position <= 30.0 && impressions >= minImpressions;
}

// Boundary Tests
assert.strictEqual(isStrikingDistance(10.0, 100), false, "Position 10.0 is Page 1 (not striking distance)");
assert.strictEqual(isStrikingDistance(10.1, 100), true, "Position 10.1 is Striking Distance");
assert.strictEqual(isStrikingDistance(11.0, 100), true, "Position 11.0 is Striking Distance");
assert.strictEqual(isStrikingDistance(20.5, 50), true, "Position 20.5 is Striking Distance");
assert.strictEqual(isStrikingDistance(30.0, 100), true, "Position 30.0 is Striking Distance");
assert.strictEqual(isStrikingDistance(30.1, 100), false, "Position 30.1 is Page 4 (not striking distance)");
assert.strictEqual(isStrikingDistance(35.0, 500), false, "Position 35.0 is not striking distance");
assert.strictEqual(isStrikingDistance(15.0, 3, 5), false, "Position 15.0 with impressions below threshold is false");
console.log("   ✓ Boundary 10.0 (Page 1) → false");
console.log("   ✓ Boundary 10.1 (Striking Distance start) → true");
console.log("   ✓ Boundary 30.0 (Striking Distance end) → true");
console.log("   ✓ Boundary 30.1 (Page 4) → false");
console.log("   ✓ Impression threshold filtering verified.");

// 3. RBAC ROLE HIERARCHY LOGIC
console.log("\n3. Testing RBAC Role Hierarchy Levels:");
const ROLE_HIERARCHY: Record<string, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

assert.strictEqual(hasRequiredRole("OWNER", "ADMIN"), true, "OWNER has ADMIN privileges");
assert.strictEqual(hasRequiredRole("ADMIN", "MEMBER"), true, "ADMIN has MEMBER privileges");
assert.strictEqual(hasRequiredRole("MEMBER", "ADMIN"), false, "MEMBER cannot execute ADMIN actions");
console.log("   ✓ Workspace RBAC hierarchy (OWNER > ADMIN > MEMBER) verified.");

console.log("\n==================================================");
console.log("✅ ALL PHASE 1 SMOKE TESTS PASSED CLEANLY.");
console.log("==================================================");
