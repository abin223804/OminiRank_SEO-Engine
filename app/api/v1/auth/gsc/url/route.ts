import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const projectId = searchParams.get("projectId");

    if (workspaceId) {
      await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");
    }

    const clientId = process.env.GSC_CLIENT_ID;
    const redirectUri =
      process.env.GSC_REDIRECT_URI || "http://localhost:3000/api/v1/auth/gsc/callback";

    if (!clientId) {
      return NextResponse.json(
        {
          error: "GSC_CLIENT_ID is not configured in environment variables",
          isConfigured: false,
        },
        { status: 400 }
      );
    }

    const statePayload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        workspaceId,
        projectId,
        ts: Date.now(),
      })
    ).toString("base64url");

    const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GSC_READONLY_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", statePayload);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      isConfigured: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate GSC auth URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
