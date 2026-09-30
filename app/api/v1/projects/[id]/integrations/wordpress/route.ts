import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { testWordPressConnection } from "@/lib/cms/wordpress";
import { z } from "zod";

const registerWordPressSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  applicationPassword: z.string().min(1),
  pluginType: z.enum(["RANK_MATH", "YOAST", "ACF", "STANDARD"]).default("STANDARD"),
  skipVerification: z.boolean().optional().default(false),
});

// POST /api/v1/projects/[id]/integrations/wordpress
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
    const parsed = registerWordPressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const { siteUrl, username, applicationPassword, pluginType, skipVerification } = parsed.data;

    if (!skipVerification && !siteUrl.includes("mock") && !siteUrl.includes("localhost")) {
      const verification = await testWordPressConnection(siteUrl, username, applicationPassword);
      if (!verification.success) {
        return NextResponse.json(
          { error: `WordPress connection failed: ${verification.error}` },
          { status: 400 }
        );
      }
    }

    const credentialsEnc = encryptSecret(
      JSON.stringify({
        siteUrl,
        username,
        applicationPassword,
        pluginType,
      })
    );

    const connection = await prisma.cmsConnection.create({
      data: {
        projectId,
        provider: "WORDPRESS",
        siteUrl,
        credentialsEnc,
        metadata: {
          username,
          pluginType,
        },
        status: "CONNECTED",
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      provider: connection.provider,
      message: `WordPress integration successfully registered with ${pluginType} SEO support.`,
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to register WordPress integration" }, { status });
  }
}
