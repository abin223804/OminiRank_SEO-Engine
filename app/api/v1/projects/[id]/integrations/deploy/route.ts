import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { deployEnrichmentToCms } from "@/lib/cms/dispatcher";
import { z } from "zod";

const deployCmsSchema = z.object({
  enrichmentId: z.string().min(1),
  cmsConnectionId: z.string().min(1),
  forceMock: z.boolean().optional(),
});

// POST /api/v1/projects/[id]/integrations/deploy
export async function POST(
  req: NextRequest,
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

    await validateWorkspaceMembership(user.id, project.workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = deployCmsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const result = await deployEnrichmentToCms(
      parsed.data.enrichmentId,
      parsed.data.cmsConnectionId,
      { forceMock: parsed.data.forceMock }
    );

    return NextResponse.json({
      success: true,
      deployment: result,
      message: result.message,
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to deploy enrichment to CMS" }, { status });
  }
}
