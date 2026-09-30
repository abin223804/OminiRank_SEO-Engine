import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { generateThemeCssVariables, updateWorkspaceBranding } from "@/lib/agency/branding";
import { z } from "zod";

const updateBrandingSchema = z.object({
  customDomain: z.string().nullable().optional(),
  branding: z
    .object({
      companyName: z.string().optional(),
      logoUrl: z.string().url().optional().or(z.literal("")),
      primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
      accentColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
      customSenderEmail: z.string().email().optional().or(z.literal("")),
    })
    .optional(),
});

// GET /api/v1/workspaces/[id]/branding
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    await validateWorkspaceMembership(user.id, workspaceId, "MEMBER");

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        branding: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const branding = (workspace.branding as any) || {};

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      customDomain: workspace.customDomain,
      branding,
      themeCssVars: generateThemeCssVariables(branding),
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to load branding" }, { status });
  }
}

// PUT /api/v1/workspaces/[id]/branding
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    // RBAC: Requires at least ADMIN to change agency branding
    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = updateBrandingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const updated = await updateWorkspaceBranding(workspaceId, {
      customDomain: parsed.data.customDomain,
      branding: parsed.data.branding as any,
    });

    return NextResponse.json({
      success: true,
      customDomain: updated.customDomain,
      branding: updated.branding,
      message: "Agency branding settings saved successfully.",
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to update branding" }, { status });
  }
}
