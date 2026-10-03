import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/free-audit/oauth-callback
 * Handles the Google OAuth2 authorization code callback.
 * Exchanges code for access_token, then redirects to /free-audit with the token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Handle user denial
  if (oauthError) {
    const url = new URL("/free-audit", request.url);
    url.searchParams.set("error", "Google access was denied. Please try again and allow read-only Search Console access.");
    return NextResponse.redirect(url.toString());
  }

  if (!code || !state) {
    const url = new URL("/free-audit", request.url);
    url.searchParams.set("error", "Invalid OAuth callback. Please try again.");
    return NextResponse.redirect(url.toString());
  }

  // Decode state to recover the site URL
  let site = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    site = decoded.site || "";
  } catch {
    const url = new URL("/free-audit", request.url);
    url.searchParams.set("error", "State parameter corrupted. Please try again.");
    return NextResponse.redirect(url.toString());
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/free-audit/oauth-callback`;

  // Exchange authorization code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[free-audit/oauth-callback] Token exchange failed:", errBody);
    const url = new URL("/free-audit", request.url);
    url.searchParams.set("error", "Google token exchange failed. Please try again.");
    return NextResponse.redirect(url.toString());
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Pass access token back to the client via URL param.
  // NOTE: For production harden this by storing token server-side in a signed cookie instead.
  const callbackUrl = new URL("/free-audit", request.url);
  callbackUrl.searchParams.set("gsc_token", tokenData.access_token);
  callbackUrl.searchParams.set("site", site);

  return NextResponse.redirect(callbackUrl.toString());
}
