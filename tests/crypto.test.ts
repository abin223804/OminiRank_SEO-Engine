import assert from "node:assert";
import { encryptSecret, decryptSecret } from "../lib/crypto";

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "f8a42b109e530965d1bca142e09875e53fa69dc9ef310461291f09cb8d95642a";

console.log("▶ Running AES-256-GCM Crypto Tests...");

// Test 1: Happy path round-trip
const secretJson = JSON.stringify({
  type: "service_account",
  project_id: "seo-engine-prod",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...",
  client_email: "gsc-agent@seo-engine-prod.iam.gserviceaccount.com",
});

const encrypted = encryptSecret(secretJson);
assert.ok(encrypted.includes(":"), "Encrypted format should contain delimiter ':'");
const parts = encrypted.split(":");
assert.strictEqual(parts.length, 3, "Payload must have IV, AuthTag, and Ciphertext");

const decrypted = decryptSecret(encrypted);
assert.strictEqual(decrypted, secretJson, "Decrypted text must match original plaintext");
console.log("  ✓ Happy path: Round-trip encryption and decryption matches verbatim");

// Test 2: Tamper detection (Auth Tag verification)
const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}aa`;
assert.throws(
  () => {
    decryptSecret(tamperedPayload);
  },
  /Unsupported state or unable to authenticate data/,
  "Tampered payload must be rejected by GCM authentication tag verification"
);
console.log("  ✓ Tamper detection: Modified ciphertext throws authentication failure");

// Test 3: Malformed payload format
assert.throws(
  () => {
    decryptSecret("invalid-format-without-colons");
  },
  /Malformed encrypted secret payload/,
  "Payload without 3 segments must be rejected"
);
console.log("  ✓ Format validation: Malformed string is rejected");

console.log("✅ All AES-256-GCM tests passed successfully.\n");
