import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { TIER_QUOTAS, PlanTier } from "@/lib/billing/stripe";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    await validateWorkspaceMembership(user.id, workspaceId, "MEMBER");

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          select: { id: true },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const tier = workspace.planTier as PlanTier;
    const quota = TIER_QUOTAS[tier] || TIER_QUOTAS.STARTER;

    // Monthly enrichment count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const projectIds = workspace.projects.map((p) => p.id);
    const monthlyEnrichments = await prisma.enrichmentAction.count({
      where: {
        projectId: { in: projectIds },
        createdAt: { gte: startOfMonth },
      },
    });

    return NextResponse.json({
      workspaceId: workspace.id,
      name: workspace.name,
      tier,
      usage: {
        projectsCount: workspace.projects.length,
        maxProjects: quota.maxProjects,
        monthlyEnrichmentsCount: monthlyEnrichments,
        maxEnrichmentsPerMonth: quota.maxEnrichmentsPerMonth,
      },
      quota,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch quota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
