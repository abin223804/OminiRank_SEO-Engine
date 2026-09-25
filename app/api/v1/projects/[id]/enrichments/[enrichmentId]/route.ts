import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { updateEnrichmentStatus } from "@/lib/ai/staging";
import { EnrichmentStatus } from "@/lib/ai/types";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["STAGED", "APPROVED", "REJECTED", "COMMITTED", "ROLLED_BACK"]),
  payload: z.any().optional(),
});

// GET /api/v1/projects/[id]/enrichments/[enrichmentId]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; enrichmentId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId, enrichmentId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const enrichment = await prisma.enrichmentAction.findUnique({
      where: { id: enrichmentId },
    });

    if (!enrichment || enrichment.projectId !== projectId) {
      return NextResponse.json({ error: "Enrichment action not found" }, { status: 404 });
    }

    return NextResponse.json({ enrichment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/v1/projects/[id]/enrichments/[enrichmentId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; enrichmentId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId, enrichmentId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // RBAC: Requires at least MEMBER to approve/reject
    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status or payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateEnrichmentStatus(
      enrichmentId,
      parsed.data.status as EnrichmentStatus,
      parsed.data.payload
    );

    return NextResponse.json({ enrichment: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/v1/projects/[id]/enrichments/[enrichmentId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; enrichmentId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId, enrichmentId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // RBAC: Requires at least ADMIN to delete an enrichment
    await validateWorkspaceMembership(user.id, project.workspaceId, "ADMIN");

    await prisma.enrichmentAction.delete({
      where: { id: enrichmentId },
    });

    return NextResponse.json({ success: true, deletedId: enrichmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
