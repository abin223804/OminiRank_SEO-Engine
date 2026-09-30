import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { z } from "zod";

const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8),
  events: z.array(z.enum(["RANKING_DELTA_DETECTED", "PR_DEPLOYED", "RECRAWL_PINGED", "QUOTA_WARNING"])).min(1),
  format: z.enum(["GENERIC", "SLACK", "DISCORD"]).default("GENERIC"),
});

// GET /api/v1/workspaces/[id]/webhooks
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    await validateWorkspaceMembership(user.id, workspaceId, "MEMBER");

    const webhooks = await prisma.webhookSubscription.findMany({
      where: { workspaceId },
      select: {
        id: true,
        url: true,
        events: true,
        format: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, webhooks });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to list webhooks" }, { status });
  }
}

// POST /api/v1/workspaces/[id]/webhooks
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = createWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const secretEnc = encryptSecret(parsed.data.secret);

    const webhook = await prisma.webhookSubscription.create({
      data: {
        workspaceId,
        url: parsed.data.url,
        secretEnc,
        events: parsed.data.events,
        format: parsed.data.format,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.events,
      format: webhook.format,
      message: "Webhook registered and secret encrypted at rest.",
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to create webhook" }, { status });
  }
}
