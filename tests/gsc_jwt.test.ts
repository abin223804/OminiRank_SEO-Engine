import assert from "node:assert";
import crypto from "node:crypto";
import {
  parseServiceAccountJson,
  createServiceAccountAssertion,
  base64UrlEncode,
} from "../lib/gsc/jwt";

console.log("==================================================");
console.log("▶ RUNNING GSC RSA-SHA256 JWT & AUTH TESTS");
console.log("==================================================\n");

// Generate realistic RSA 2048 keypair on the fly for hermetic unit testing
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const mockCredentials = {
  type: "service_account",
  project_id: "omnirank-test-project",
  private_key_id: "key-12345",
  private_key: privateKey,
  client_email: "test-sa@omnirank-test-project.iam.gserviceaccount.com",
};

// 1. Test parsing
console.log("1. Testing Service Account JSON parsing:");
const validJson = JSON.stringify(mockCredentials);
const parsed = parseServiceAccountJson(validJson);
assert.strictEqual(parsed.client_email, mockCredentials.client_email);
assert.strictEqual(parsed.private_key, mockCredentials.private_key);
console.log("   ✓ Valid Service Account JSON parsed correctly.");

assert.throws(
  () => parseServiceAccountJson(JSON.stringify({ private_key: "abc" })),
  /Missing or invalid 'client_email'/,
  "Must reject JSON without client_email"
);
console.log("   ✓ Missing client_email correctly rejected.");

// 2. Test assertion creation & RSA-SHA256 signature verification
console.log("\n2. Testing RSA-SHA256 JWT assertion generation & cryptographic verification:");
const assertion = createServiceAccountAssertion(mockCredentials);
const parts = assertion.split(".");
assert.strictEqual(parts.length, 3, "JWT must consist of exactly 3 parts (header.payload.sig)");

// Decode header and payload
const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));

assert.strictEqual(header.alg, "RS256");
assert.strictEqual(header.typ, "JWT");
assert.strictEqual(payload.iss, mockCredentials.client_email);
assert.strictEqual(payload.aud, "https://oauth2.googleapis.com/token");
assert.ok(payload.exp > payload.iat, "exp must be after iat");
console.log("   ✓ JWT header and claims structure verified.");

// Verify signature with native crypto verifier and public key
const verifier = crypto.createVerify("RSA-SHA256");
verifier.update(`${parts[0]}.${parts[1]}`);
verifier.end();

const isValidSignature = verifier.verify(publicKey, Buffer.from(parts[2], "base64url"));
assert.strictEqual(isValidSignature, true, "RSA-SHA256 signature must be mathematically valid");
console.log("   ✓ RSA-SHA256 signature verified with public key.");

// 3. Test Base64Url encoding helper
console.log("\n3. Testing Base64Url encoding format:");
const sample = "Hello? World! === +++ ///";
const encoded = base64UrlEncode(sample);
assert.ok(!encoded.includes("="), "Must not have padding");
assert.ok(!encoded.includes("+"), "Must not have pluses");
assert.ok(!encoded.includes("/"), "Must not have slashes");
console.log("   ✓ RFC 7515 Base64Url compliance verified.");

console.log("\n==================================================");
console.log("✅ ALL GSC RSA-SHA256 JWT TESTS PASSED.");
console.log("==================================================");
