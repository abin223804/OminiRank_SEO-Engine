import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

// GET /api/v1/projects/[id]/integrations
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const connections = await prisma.cmsConnection.findMany({
      where: { projectId },
      select: {
        id: true,
        provider: true,
        siteUrl: true,
        metadata: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      connections,
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to list integrations" }, { status });
  }
}
