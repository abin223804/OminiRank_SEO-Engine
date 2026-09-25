import crypto from "node:crypto";
import { GoogleServiceAccountKey } from "./types";

const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

/**
 * Base64URL encoder helper according to RFC 7515 / RFC 7519
 */
export function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Safely parses and validates Google Service Account JSON payload
 */
export function parseServiceAccountJson(jsonString: string): GoogleServiceAccountKey {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.client_email || typeof parsed.client_email !== "string") {
      throw new Error("Missing or invalid 'client_email' in Service Account credentials");
    }
    if (!parsed.private_key || typeof parsed.private_key !== "string") {
      throw new Error("Missing or invalid 'private_key' in Service Account credentials");
    }
    return parsed as GoogleServiceAccountKey;
  } catch (error) {
    throw new Error(
      `Service Account JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generates an RFC 7523 RSA-SHA256 signed JWT assertion for Google OAuth2
 */
export function createServiceAccountAssertion(
  credentials: GoogleServiceAccountKey,
  scope: string = GSC_READONLY_SCOPE,
  expiresInSeconds: number = 3600
): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri || GOOGLE_TOKEN_URI;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    exp: now + expiresInSeconds,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with RSA-SHA256 using Node's native crypto engine
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(credentials.private_key);
  const encodedSignature = base64UrlEncode(signature);

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * In-memory token cache to prevent redundant token exchanges
 */
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * Obtains an access token using Service Account assertion, with caching
 */
export async function getServiceAccountAccessToken(
  credentials: GoogleServiceAccountKey,
  scope: string = GSC_READONLY_SCOPE
): Promise<string> {
  const cacheKey = `${credentials.client_email}:${scope}`;
  const cached = tokenCache.get(cacheKey);

  // Return cached token if valid for more than 5 minutes
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.accessToken;
  }

  const assertion = createServiceAccountAssertion(credentials, scope);
  const tokenUri = credentials.token_uri || GOOGLE_TOKEN_URI;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google OAuth2 token exchange failed (${response.status}): ${errorBody}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiresAt = Date.now() + tokenData.expires_in * 1000;
  tokenCache.set(cacheKey, {
    accessToken: tokenData.access_token,
    expiresAt,
  });

  return tokenData.access_token;
}

/**
 * Clear cached tokens (useful for testing or key rotation)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}
