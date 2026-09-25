import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { z } from "zod";

const createProjectSchema = z.object({
  workspaceId: z.string().cuid("Invalid workspace ID"),
  name: z.string().min(2).max(100),
  siteUrl: z.string().url("Must be a valid URL (e.g. https://example.com)"),
  gscPropertyId: z.string().min(3, "GSC Property ID required (e.g. sc-domain:example.com or URL)"),
  deploymentMode: z.enum(["AUTO_PR", "DIRECT_COMMIT", "WEBHOOK_ONLY"]).default("AUTO_PR"),
  githubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be owner/repo format").optional().nullable(),
  githubBranch: z.string().default("main"),
  githubToken: z.string().optional().nullable(),
  gscAuthMethod: z.enum(["OAUTH", "SERVICE_ACCOUNT"]).default("OAUTH"),
  gscServiceAccountJson: z.string().optional().nullable(),
});

// GET /api/v1/projects?workspaceId=...
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Query parameter 'workspaceId' is required" },
        { status: 400 }
      );
    }

    // RBAC validation: user must be a member
    await validateWorkspaceMembership(user.id, workspaceId, "MEMBER");

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            snapshots: true,
            queries: true,
            competitors: true,
            enrichments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Strip encrypted secrets from response for security
    const safeProjects = projects.map((p) => {
      const { githubTokenEnc, gscServiceAccountJsonEnc, ...safe } = p;
      return {
        ...safe,
        hasGithubToken: Boolean(githubTokenEnc),
        hasServiceAccountJson: Boolean(gscServiceAccountJsonEnc),
      };
    });

    return NextResponse.json({ projects: safeProjects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch projects";
    const status = error && typeof error === "object" && "name" in error && error.name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/v1/projects - Registers a new tracking project & domain
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // RBAC: Requires at least ADMIN role to create projects in workspace
    await validateWorkspaceMembership(user.id, data.workspaceId, "ADMIN");

    // Encrypt sensitive credentials if provided
    const githubTokenEnc = data.githubToken ? encryptSecret(data.githubToken) : null;
    const gscServiceAccountJsonEnc = data.gscServiceAccountJson
      ? encryptSecret(data.gscServiceAccountJson)
      : null;

    const project = await prisma.project.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        siteUrl: data.siteUrl,
        gscPropertyId: data.gscPropertyId,
        deploymentMode: data.deploymentMode,
        githubRepo: data.githubRepo,
        githubBranch: data.githubBranch,
        githubTokenEnc,
        gscAuthMethod: data.gscAuthMethod,
        gscServiceAccountJsonEnc,
      },
    });

    // Return safe project representation
    const { githubTokenEnc: _, gscServiceAccountJsonEnc: __, ...safeProject } = project;

    return NextResponse.json(
      {
        project: {
          ...safeProject,
          hasGithubToken: Boolean(githubTokenEnc),
          hasServiceAccountJson: Boolean(gscServiceAccountJsonEnc),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/v1/projects error:", error);
    const message = error instanceof Error ? error.message : "Failed to create project";
    const status = error && typeof error === "object" && "name" in error && error.name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
