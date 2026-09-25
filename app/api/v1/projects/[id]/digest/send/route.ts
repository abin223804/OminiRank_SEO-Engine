import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { sendExecutiveDigest, generateExecutiveDigest } from "@/lib/email/digest";
import { z } from "zod";

const sendDigestSchema = z.object({
  recipientEmails: z.array(z.string().email()).optional(),
  forceMock: z.boolean().optional(),
  previewOnly: z.boolean().optional(),
});

// POST /api/v1/projects/[id]/digest/send
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // RBAC: Requires at least MEMBER role to view or trigger digest
    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const body = await req.json().catch(() => ({}));
    const parsed = sendDigestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid digest request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Support preview-only mode to render HTML directly in dashboard UI or tests
    if (parsed.data.previewOnly) {
      const digestPreview = await generateExecutiveDigest(projectId);
      return NextResponse.json({
        success: true,
        preview: digestPreview,
      });
    }

    const result = await sendExecutiveDigest(projectId, {
      recipientEmails: parsed.data.recipientEmails,
      forceMock: parsed.data.forceMock,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Executive digest dispatched to ${result.recipients.length} recipient(s).`,
    });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/digest/send error:", error);
    const message = error instanceof Error ? error.message : "Digest dispatch failed";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
