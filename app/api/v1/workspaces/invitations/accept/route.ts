import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

// POST /api/v1/workspaces/invitations/accept - Accept invitation token and join workspace
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation token." },
        { status: 404 }
      );
    }

    if (new Date() > invitation.expiresAt) {
      // Clean up expired invite
      await prisma.workspaceInvitation.delete({ where: { id: invitation.id } }).catch(() => {});
      return NextResponse.json(
        { error: "This invitation link has expired. Please request a new invite." },
        { status: 410 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
        },
      },
    });

    if (existingMember) {
      // Remove used invitation
      await prisma.workspaceInvitation.delete({ where: { id: invitation.id } }).catch(() => {});
      return NextResponse.json({
        success: true,
        message: "You are already a member of this workspace.",
        workspace: invitation.workspace,
      });
    }

    // Add user as member and delete invitation in transaction
    const newMember = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      await tx.workspaceInvitation.delete({
        where: { id: invitation.id },
      });

      return member;
    });

    return NextResponse.json({
      success: true,
      workspace: invitation.workspace,
      membership: newMember,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Failed to accept workspace invitation" },
      { status: 500 }
    );
  }
}
