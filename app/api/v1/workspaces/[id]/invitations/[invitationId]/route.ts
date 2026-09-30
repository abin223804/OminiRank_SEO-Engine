import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

// DELETE /api/v1/workspaces/[id]/invitations/[invitationId] - Revoke pending invitation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId, invitationId } = await params;

    // Caller must be ADMIN or OWNER to revoke invites
    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({ success: true, revokedInvitationId: invitationId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("DELETE invitation error:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
