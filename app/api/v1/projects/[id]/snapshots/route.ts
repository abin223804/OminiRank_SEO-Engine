import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
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

    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const snapshots = await prisma.searchSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        _count: {
          select: {
            queries: true,
          },
        },
      },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/snapshots error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch snapshots";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
