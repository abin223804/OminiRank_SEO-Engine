import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { analyzeAndSaveCompetitor, getProjectCompetitors } from "@/lib/competitor/service";
import { z } from "zod";

const addCompetitorSchema = z.object({
  scrapeUrl: z.string().min(3, "URL is required"),
  targetKeyword: z.string().optional(),
});

// GET /api/v1/projects/[id]/competitors - List competitors for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const competitors = await getProjectCompetitors(projectId);

    return NextResponse.json({ competitors });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("GET /api/v1/projects/[id]/competitors error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve competitors" },
      { status: 500 }
    );
  }
}

// POST /api/v1/projects/[id]/competitors - Scrape & register a competitor
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = addCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { scrapeUrl, targetKeyword } = parsed.data;

    const result = await analyzeAndSaveCompetitor(projectId, scrapeUrl, targetKeyword);

    return NextResponse.json({ competitor: result }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/v1/projects/[id]/competitors error:", error);
    return NextResponse.json(
      { error: "Failed to scrape and save competitor" },
      { status: 500 }
    );
  }
}
