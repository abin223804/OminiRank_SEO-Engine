import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { deployEnrichmentToGit } from "@/lib/deployment/git";
import { z } from "zod";

const deploySchema = z.object({
  enrichmentId: z.string().cuid(),
  forceMock: z.boolean().optional(),
});

// POST /api/v1/projects/[id]/deploy
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

    // RBAC: Requires at least ADMIN role to execute production Git deployment
    await validateWorkspaceMembership(user.id, project.workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = deploySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid deployment payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await deployEnrichmentToGit(parsed.data.enrichmentId, {
      forceMock: parsed.data.forceMock,
    });

    return NextResponse.json({
      success: true,
      deployment: result,
      message: `Enrichment successfully validated in sandbox and deployed! PR #${result.prNumber} opened on branch '${result.branchName}'.`,
    });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/deploy error:", error);
    const message = error instanceof Error ? error.message : "Deployment failed";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
