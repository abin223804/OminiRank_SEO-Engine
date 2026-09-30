import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { buildGitHubAppManifest } from "@/lib/cms/github-app";
import { z } from "zod";

const registerGitHubAppSchema = z.object({
  action: z.enum(["MANIFEST", "REGISTER"]),
  appId: z.union([z.number(), z.string()]).optional(),
  slug: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  privateKeyPem: z.string().optional(),
  installationId: z.union([z.number(), z.string()]).optional(),
  repo: z.string().optional(),
  baseBranch: z.string().optional().default("main"),
});

// POST /api/v1/projects/[id]/integrations/github-app
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = registerGitHubAppSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    if (parsed.data.action === "MANIFEST") {
      const origin = req.nextUrl.origin;
      const manifest = buildGitHubAppManifest({
        appName: `OmniRank-${project.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
        redirectUrl: `${origin}/api/v1/projects/${project.id}/integrations/github-app/callback`,
      });

      return NextResponse.json({
        success: true,
        manifest,
        manifestCreationUrl: "https://github.com/settings/apps/new",
      });
    }

    // action === "REGISTER"
    if (!parsed.data.appId || !parsed.data.clientId || !parsed.data.privateKeyPem) {
      return NextResponse.json(
        { error: "appId, clientId, and privateKeyPem are required to register a GitHub App" },
        { status: 400 }
      );
    }

    const credentialsEnc = encryptSecret(
      JSON.stringify({
        appId: parsed.data.appId,
        slug: parsed.data.slug,
        clientId: parsed.data.clientId,
        clientSecret: parsed.data.clientSecret || "",
        privateKeyPem: parsed.data.privateKeyPem,
        installationId: parsed.data.installationId,
      })
    );

    const connection = await prisma.cmsConnection.create({
      data: {
        projectId,
        provider: "GITHUB_APP",
        siteUrl: `https://github.com/${parsed.data.repo || "omnirank"}`,
        credentialsEnc,
        metadata: {
          repo: parsed.data.repo,
          baseBranch: parsed.data.baseBranch,
          installationId: parsed.data.installationId,
        },
        status: "CONNECTED",
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      provider: connection.provider,
      message: "GitHub App successfully connected and encrypted at rest.",
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to process GitHub App integration" }, { status });
  }
}
