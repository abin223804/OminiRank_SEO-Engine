import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { syncProjectSearchConsole } from "@/lib/gsc/sync";

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

    // RBAC: Requires at least MEMBER role to trigger a sync
    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    // Check optional body parameters (e.g. forceMock, date ranges)
    let body: { forceMock?: boolean; startDate?: string; endDate?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const result = await syncProjectSearchConsole(projectId, {
      forceMock: body.forceMock,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully synchronized ${result.queriesCount} queries (${result.strikingDistanceCount} striking distance targets).`,
    });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/sync error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
