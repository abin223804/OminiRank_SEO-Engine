import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. A 32-byte hex string (64 characters) is required."
    );
  }

  const keyBuffer = Buffer.from(keyHex.trim(), "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY length: expected 32 bytes (64 hex characters), received ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Encrypts sensitive secret strings (e.g. GitHub tokens, GSC Service Account JSON keys)
 * using AES-256-GCM with authenticated tags.
 *
 * Serialized output format: `${ivHex}:${authTagHex}:${encryptedHex}`
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty or null secret.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a secret encrypted with encryptSecret.
 * Verifies authenticity with GCM auth tag; throws if tampered with or corrupted.
 */
export function decryptSecret(payload: string): string {
  if (!payload || typeof payload !== "string") {
    throw new Error("Invalid encrypted payload format.");
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed encrypted secret payload. Expected format: iv:authTag:ciphertext"
    );
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(
      `Invalid Auth Tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTag.length}`
    );
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
