import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/free-audit/oauth-start
 * Starts a Google OAuth2 flow with read-only Search Console scope.
 * After consent, Google redirects to /api/v1/free-audit/oauth-callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const site = searchParams.get("site");

  if (!site) {
    return NextResponse.json({ error: "Missing site parameter" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/free-audit/oauth-callback`;

  if (!clientId) {
    // Dev fallback: simulate the flow locally with mock data
    const devCallbackUrl = new URL("/free-audit", request.url);
    devCallbackUrl.searchParams.set("gsc_token", "DEV_MOCK_TOKEN");
    devCallbackUrl.searchParams.set("site", site);
    return NextResponse.redirect(devCallbackUrl.toString());
  }

  // Encode the site URL as state so we can retrieve it in the callback
  const state = Buffer.from(JSON.stringify({ site })).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/webmasters.readonly");
  authUrl.searchParams.set("access_type", "online"); // No refresh token — one-time audit
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
