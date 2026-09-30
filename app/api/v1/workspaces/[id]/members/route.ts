import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { z } from "zod";

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

// GET /api/v1/workspaces/[id]/members - List all members and pending invitations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await params;

    // Caller must be at least a member of the workspace
    const { membership } = await validateWorkspaceMembership(user.id, workspaceId, "MEMBER");

    // Fetch all active members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
      orderBy: { role: "desc" },
    });

    // If caller is ADMIN or OWNER, also return pending invitations
    let invitations: Array<{
      id: string;
      email: string;
      role: string;
      expiresAt: Date;
      createdAt: Date;
      token: string;
    }> = [];

    if (membership.role === "ADMIN" || membership.role === "OWNER") {
      invitations = await prisma.workspaceInvitation.findMany({
        where: {
          workspaceId,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          token: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        userId: m.userId,
        user: m.user,
      })),
      invitations,
      callerRole: membership.role,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("GET /api/v1/workspaces/[id]/members error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve workspace members" },
      { status: 500 }
    );
  }
}

// POST /api/v1/workspaces/[id]/members - Invite a new member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: workspaceId } = await params;

    // Caller must be ADMIN or OWNER to send invites
    await validateWorkspaceMembership(user.id, workspaceId, "ADMIN");

    const body = await req.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if the user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: `User with email '${normalizedEmail}' is already a member of this workspace.` },
          { status: 409 }
        );
      }
    }

    // Generate secure invitation token valid for 7 days
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Upsert invitation (update expiration & token if already invited)
    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        workspaceId_email: {
          workspaceId,
          email: normalizedEmail,
        },
      },
      update: {
        role,
        token,
        expiresAt,
        invitedById: user.id,
      },
      create: {
        workspaceId,
        email: normalizedEmail,
        role,
        token,
        expiresAt,
        invitedById: user.id,
      },
    });

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const inviteUrl = `${protocol}://${host}/login?inviteToken=${token}`;

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          token: invitation.token,
        },
        inviteUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/v1/workspaces/[id]/members error:", error);
    return NextResponse.json(
      { error: "Failed to create workspace invitation" },
      { status: 500 }
    );
  }
}
