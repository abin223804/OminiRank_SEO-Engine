import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { syncQueue } from "@/lib/gsc/queue";

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

    const jobs = syncQueue.getProjectJobs(projectId);

    return NextResponse.json({
      projectId,
      jobs: jobs.slice(0, 5), // Return most recent 5 jobs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sync status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
