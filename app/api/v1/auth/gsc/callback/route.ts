import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return NextResponse.redirect(
        new URL(`/?authError=${encodeURIComponent(errorParam)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code missing in callback" },
        { status: 400 }
      );
    }

    let parsedState: { userId?: string; workspaceId?: string; projectId?: string } = {};
    if (state) {
      try {
        parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      } catch {
        // State decoding fallback
      }
    }

    const clientId = process.env.GSC_CLIENT_ID;
    const clientSecret = process.env.GSC_CLIENT_SECRET;
    const redirectUri =
      process.env.GSC_REDIRECT_URI || "http://localhost:3000/api/v1/auth/gsc/callback";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured on server" },
        { status: 500 }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return NextResponse.redirect(
        new URL(`/?authError=${encodeURIComponent("Token exchange failed")}`, req.url)
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    // If projectId was in state, store encrypted refresh token or credentials
    if (parsedState.projectId) {
      const secretToStore = tokenData.refresh_token || tokenData.access_token;
      await prisma.project.update({
        where: { id: parsedState.projectId },
        data: {
          gscAuthMethod: "OAUTH",
          gscServiceAccountJsonEnc: encryptSecret(
            JSON.stringify({
              type: "oauth_token",
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
            })
          ),
        },
      });
    }

    return NextResponse.redirect(
      new URL(
        `/?gscConnected=true${parsedState.projectId ? `&projectId=${parsedState.projectId}` : ""}`,
        req.url
      )
    );
  } catch (error) {
    console.error("GET /api/v1/auth/gsc/callback error:", error);
    return NextResponse.redirect(
      new URL(`/?authError=${encodeURIComponent("GSC Callback processing failed")}`, req.url)
    );
  }
}
