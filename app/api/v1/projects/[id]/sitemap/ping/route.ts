import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { triggerPostDeploymentRecrawl } from "@/lib/gsc/sitemap";
import { z } from "zod";

const sitemapPingSchema = z.object({
  sitemapUrl: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  forceMock: z.boolean().optional(),
});

// POST /api/v1/projects/[id]/sitemap/ping
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

    // RBAC: Requires at least MEMBER role to ping sitemap
    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const body = await req.json().catch(() => ({}));
    const parsed = sitemapPingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid sitemap ping payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await triggerPostDeploymentRecrawl(
      projectId,
      parsed.data.urls || [],
      {
        sitemapUrl: parsed.data.sitemapUrl,
        forceMock: parsed.data.forceMock,
      }
    );

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.sitemapResult.message,
    });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/sitemap/ping error:", error);
    const message = error instanceof Error ? error.message : "Sitemap ping failed";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
