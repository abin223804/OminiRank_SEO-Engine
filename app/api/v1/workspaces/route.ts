import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and dashes"),
});

// Helper to generate a unique slug for auto-provisioned workspaces
async function generateUniqueSlug(base: string): Promise<string> {
  const sanitized =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";

  let slug = sanitized;
  let counter = 0;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    slug = `${sanitized}-${randomSuffix}`;
    counter++;
    if (counter > 5) {
      slug = `${sanitized}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
}

// GET /api/v1/workspaces - Lists workspaces for the authenticated user
export async function GET() {
  try {
    const user = await getCurrentUser();

    let members = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                projects: true,
                members: true,
              },
            },
          },
        },
      },
      orderBy: { workspace: { createdAt: "asc" } },
    });

    // Auto-provision personal workspace if user has none (e.g. first login)
    if (members.length === 0) {
      const displayName = user.name || user.email.split("@")[0] || "My Workspace";
      const defaultName = displayName.toLowerCase().includes("workspace")
        ? displayName
        : `${displayName}'s Workspace`;

      const slug = await generateUniqueSlug(user.name || user.email.split("@")[0] || "workspace");

      await prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: defaultName,
            slug,
            planTier: "STARTER",
          },
        });

        await tx.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: ws.id,
            role: "OWNER",
          },
        });
      });

      members = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        include: {
          workspace: {
            include: {
              _count: {
                select: {
                  projects: true,
                  members: true,
                },
              },
            },
          },
        },
        orderBy: { workspace: { createdAt: "asc" } },
      });
    }

    const workspaces = members.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("GET /api/v1/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve workspaces" },
      { status: 500 }
    );
  }
}

// POST /api/v1/workspaces - Creates a new workspace and sets user as OWNER
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, slug } = parsed.data;

    // Check if slug is already taken
    const existing = await prisma.workspace.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Workspace slug '${slug}' is already taken.` },
        { status: 409 }
      );
    }

    // Create workspace and assign owner in a single transaction
    const newWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          planTier: "STARTER",
        },
      });

      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: ws.id,
          role: "OWNER",
        },
      });

      return ws;
    });

    return NextResponse.json({ workspace: newWorkspace }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
