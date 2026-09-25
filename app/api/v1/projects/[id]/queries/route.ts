import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await validateWorkspaceMembership(user.id, project.workspaceId, "MEMBER");

    const { searchParams } = new URL(req.url);
    const strikingDistanceOnly = searchParams.get("strikingDistanceOnly") === "true";
    const search = searchParams.get("search")?.trim() || "";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const sortBy = searchParams.get("sortBy") || "impressions";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const snapshotIdParam = searchParams.get("snapshotId");

    let snapshotId = snapshotIdParam;
    if (!snapshotId) {
      const latestSnapshot = await prisma.searchSnapshot.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      snapshotId = latestSnapshot?.id ?? null;
    }

    if (!snapshotId) {
      return NextResponse.json({
        queries: [],
        total: 0,
        snapshot: null,
      });
    }

    const snapshot = await prisma.searchSnapshot.findUnique({
      where: { id: snapshotId },
    });

    // Build Prisma where clause
    const where: {
      projectId: string;
      snapshotId: string;
      isStrikingDistance?: boolean;
      query?: { contains: string; mode: "insensitive" };
    } = {
      projectId,
      snapshotId,
    };

    if (strikingDistanceOnly) {
      where.isStrikingDistance = true;
    }

    if (search) {
      where.query = { contains: search, mode: "insensitive" };
    }

    const validSortFields = ["impressions", "clicks", "ctr", "position", "positionDelta"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "impressions";

    const [queries, total] = await Promise.all([
      prisma.rankedQuery.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.rankedQuery.count({ where }),
    ]);

    return NextResponse.json({
      snapshot,
      queries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/queries error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch queries";
    const status =
      error && typeof error === "object" && "name" in error && error.name === "ForbiddenError"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
