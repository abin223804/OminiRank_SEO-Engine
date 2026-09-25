import { prisma } from "@/lib/prisma";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: Invalid or missing authentication") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden: Insufficient workspace permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Validates that the given user is a member of the workspace and has at least
 * the requested minimum role level.
 */
export async function validateWorkspaceMembership(
  userId: string,
  workspaceId: string,
  requiredRole: WorkspaceRole = "MEMBER"
) {
  if (!userId || !workspaceId) {
    throw new UnauthorizedError("User ID and Workspace ID are required.");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw new ForbiddenError(
      `Access denied: User is not a registered member of workspace '${workspaceId}'.`
    );
  }

  const userRoleLevel = ROLE_HIERARCHY[membership.role as WorkspaceRole] || 1;
  const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    throw new ForbiddenError(
      `Insufficient permissions: Action requires '${requiredRole}' role, but user has '${membership.role}'.`
    );
  }

  return {
    membership,
    workspace: membership.workspace,
  };
}
