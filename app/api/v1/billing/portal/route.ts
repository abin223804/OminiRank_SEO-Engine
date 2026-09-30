import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import { createCustomerPortalSession } from "@/lib/billing/stripe";
import { z } from "zod";

const portalSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = portalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId } = parsed.data;

    // Caller must have at least ADMIN privilege to manage billing
    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const session = await createCustomerPortalSession({
      workspaceId,
      returnUrl: `${origin}/`,
    });

    return NextResponse.json({
      portalUrl: session.url,
      isMock: session.isMock,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/v1/billing/portal error:", error);
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
