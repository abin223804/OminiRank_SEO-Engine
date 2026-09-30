import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

// PATCH /api/v1/workspaces/[id]/members/[memberId] - Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId, memberId } = await params;

    // Only OWNER can alter roles
    await validateWorkspaceMembership(user.id, workspaceId, "OWNER");

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Member not found in workspace" }, { status: 404 });
    }

    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "Workspace OWNER role cannot be modified here." },
        { status: 400 }
      );
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: parsed.data.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("PATCH /api/v1/workspaces/[id]/members/[memberId] error:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/workspaces/[id]/members/[memberId] - Remove a member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId, memberId } = await params;

    const { membership: callerMembership } = await validateWorkspaceMembership(
      user.id,
      workspaceId,
      "ADMIN"
    );

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Member not found in workspace" }, { status: 404 });
    }

    // Role hierarchy guards
    if (targetMember.role === "OWNER") {
      // Check how many owners exist
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the sole owner of a workspace." },
          { status: 400 }
        );
      }
      if (callerMembership.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only an OWNER can remove another OWNER." },
          { status: 403 }
        );
      }
    }

    if (targetMember.role === "ADMIN" && callerMembership.role !== "OWNER" && targetMember.userId !== user.id) {
      return NextResponse.json(
        { error: "Only an OWNER can remove an ADMIN." },
        { status: 403 }
      );
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true, removedMemberId: memberId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("DELETE /api/v1/workspaces/[id]/members/[memberId] error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
