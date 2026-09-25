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

    const { searchParams } = new URL(req.url);
    const event = searchParams.get("event");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const where: { projectId: string; event?: string } = { projectId };
    if (event) {
      where.event = event;
    }

    const [audits, total] = await Promise.all([
      prisma.deploymentAudit.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.deploymentAudit.count({ where }),
    ]);

    return NextResponse.json({ audits, total, limit, offset });
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/audits error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch deployment audits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
