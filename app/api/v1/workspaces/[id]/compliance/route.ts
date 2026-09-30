import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { purgeWorkspaceData } from "@/lib/compliance/gdpr";

// DELETE /api/v1/workspaces/[id]/compliance (GDPR Right-to-be-Forgotten)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    // RBAC: Only OWNER can initiate full workspace right-to-be-forgotten deletion
    await validateWorkspaceMembership(user.id, workspaceId, "OWNER");

    const result = await purgeWorkspaceData(workspaceId);

    return NextResponse.json({
      success: true,
      message: "Workspace and all linked assets permanently purged under GDPR right-to-be-forgotten.",
      result,
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to purge workspace data" }, { status });
  }
}
