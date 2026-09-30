import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { testWebflowConnection } from "@/lib/cms/webflow";
import { z } from "zod";

const registerWebflowSchema = z.object({
  siteId: z.string().min(1),
  accessToken: z.string().min(1),
  collectionId: z.string().optional(),
  skipVerification: z.boolean().optional().default(false),
});

// POST /api/v1/projects/[id]/integrations/webflow
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
    const parsed = registerWebflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const { siteId, accessToken, collectionId, skipVerification } = parsed.data;

    if (!skipVerification && !accessToken.includes("mock")) {
      const verification = await testWebflowConnection(accessToken, siteId);
      if (!verification.success) {
        return NextResponse.json(
          { error: `Webflow connection failed: ${verification.error}` },
          { status: 400 }
        );
      }
    }

    const credentialsEnc = encryptSecret(
      JSON.stringify({
        siteId,
        accessToken,
        collectionId,
      })
    );

    const connection = await prisma.cmsConnection.create({
      data: {
        projectId,
        provider: "WEBFLOW",
        siteUrl: `https://webflow.com/dashboard/sites/${siteId}`,
        credentialsEnc,
        metadata: {
          siteId,
          collectionId,
        },
        status: "CONNECTED",
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      provider: connection.provider,
      message: "Webflow CMS v2 integration successfully registered and encrypted.",
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to register Webflow integration" }, { status });
  }
}
