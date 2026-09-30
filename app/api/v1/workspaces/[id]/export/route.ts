import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { exportWorkspaceData } from "@/lib/compliance/gdpr";

// GET /api/v1/workspaces/[id]/export
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await context.params;

    // RBAC: Only OWNER or ADMIN can perform full GDPR export
    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const exportData = await exportWorkspaceData(workspaceId);

    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="omnirank-export-${workspaceId}.json"`,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    const status = error.name === "ForbiddenError" ? 403 : error.name === "UnauthorizedError" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Failed to export workspace data" }, { status });
  }
}
