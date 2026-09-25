import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { stageEnrichmentAction, listProjectEnrichments } from "@/lib/ai/staging";
import { EnrichmentType, EnrichmentStatus } from "@/lib/ai/types";
import { z } from "zod";

const createEnrichmentSchema = z.object({
  queryId: z.string().optional(),
  queryText: z.string().min(2).optional(),
  targetPageUrl: z.string().url().optional(),
  type: z.enum(["FAQ", "COMPARISON", "CODE_SNIPPET", "META_TAGS"]).default("FAQ"),
  competitorContext: z.array(z.string()).optional(),
});

// GET /api/v1/projects/[id]/enrichments
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
    const status = searchParams.get("status") as EnrichmentStatus | undefined;
    const type = searchParams.get("type") as EnrichmentType | undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await listProjectEnrichments(projectId, {
      status: status || undefined,
      type: type || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/enrichments error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch enrichments";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/v1/projects/[id]/enrichments - Generates & stages an AI enrichment
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

    // RBAC: Requires at least MEMBER role to stage AI actions
    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const body = await req.json();
    const parsed = createEnrichmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const enrichment = await stageEnrichmentAction(projectId, {
      queryId: data.queryId,
      queryText: data.queryText,
      targetPageUrl: data.targetPageUrl,
      type: data.type,
      competitorContext: data.competitorContext,
    });

    return NextResponse.json({ enrichment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/enrichments error:", error);
    const message = error instanceof Error ? error.message : "Failed to stage enrichment";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
