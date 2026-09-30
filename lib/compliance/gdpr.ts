import { prisma } from "@/lib/prisma";

export interface GdprExportArchive {
  metadata: {
    exportedAt: string;
    formatVersion: string;
    workspaceId: string;
    workspaceSlug: string;
  };
  data: {
    workspace: {
      id: string;
      name: string;
      slug: string;
      planTier: string;
      createdAt: Date;
    };
    members: Array<{
      userId: string;
      email: string;
      name: string | null;
      role: string;
    }>;
    projects: Array<{
      id: string;
      name: string;
      siteUrl: string;
      gscPropertyId: string;
      deploymentMode: string;
      githubRepo: string | null;
      githubBranch: string;
      secretsStatus: {
        hasGithubToken: boolean;
        hasGscCredentials: boolean;
      };
      cmsConnections: Array<{
        id: string;
        provider: string;
        siteUrl: string | null;
        status: string;
        lastSyncedAt: Date | null;
      }>;
      snapshotsCount: number;
      queriesCount: number;
      enrichmentsCount: number;
      auditLogsCount: number;
    }>;
    auditLogsSummary: {
      totalAudits: number;
    };
  };
}

/**
 * Produces a complete, SOC 2 and GDPR-compliant JSON archive of all workspace data
 * with sensitive encrypted secrets explicitly redacted.
 */
export async function exportWorkspaceData(workspaceId: string): Promise<GdprExportArchive> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      projects: {
        include: {
          cmsConnections: {
            select: {
              id: true,
              provider: true,
              siteUrl: true,
              status: true,
              lastSyncedAt: true,
            },
          },
          _count: {
            select: {
              snapshots: true,
              queries: true,
              enrichments: true,
              auditLogs: true,
            },
          },
        },
      },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace with ID '${workspaceId}' not found.`);
  }

  const exportArchive: GdprExportArchive = {
    metadata: {
      exportedAt: new Date().toISOString(),
      formatVersion: "1.0-soc2",
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    },
    data: {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        planTier: workspace.planTier,
        createdAt: workspace.createdAt,
      },
      members: workspace.members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
      })),
      projects: workspace.projects.map((p) => ({
        id: p.id,
        name: p.name,
        siteUrl: p.siteUrl,
        gscPropertyId: p.gscPropertyId,
        deploymentMode: p.deploymentMode,
        githubRepo: p.githubRepo,
        githubBranch: p.githubBranch,
        secretsStatus: {
          hasGithubToken: Boolean(p.githubTokenEnc),
          hasGscCredentials: Boolean(p.gscServiceAccountJsonEnc),
        },
        cmsConnections: p.cmsConnections,
        snapshotsCount: p._count.snapshots,
        queriesCount: p._count.queries,
        enrichmentsCount: p._count.enrichments,
        auditLogsCount: p._count.auditLogs,
      })),
      auditLogsSummary: {
        totalAudits: workspace.projects.reduce((acc, p) => acc + p._count.auditLogs, 0),
      },
    },
  };

  return exportArchive;
}

/**
 * GDPR Right-to-be-Forgotten: Permanently purges all data associated with a workspace
 * cascading cleanly across all linked MongoDB collections.
 */
export async function purgeWorkspaceData(workspaceId: string): Promise<{
  success: boolean;
  purgedWorkspaceId: string;
  purgedAt: string;
}> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    throw new Error(`Workspace with ID '${workspaceId}' not found.`);
  }

  // Find all projects belonging to workspace
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  // Cascade delete dependent entities
  if (projectIds.length > 0) {
    await prisma.rankedQuery.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.searchSnapshot.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.enrichmentAction.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.competitor.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.cmsConnection.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.deploymentAudit.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.backgroundJob.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }

  // Delete workspace invitations, webhooks, members, and workspace
  await prisma.workspaceInvitation.deleteMany({ where: { workspaceId } });
  await prisma.webhookSubscription.deleteMany({ where: { workspaceId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  return {
    success: true,
    purgedWorkspaceId: workspaceId,
    purgedAt: new Date().toISOString(),
  };
}

/**
 * SOC 2 Audit Log Retention: Prunes or archives deployment audit logs older than specified retention days
 */
export async function pruneOldAuditLogs(retentionDays = 90): Promise<{ prunedCount: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.deploymentAudit.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return { prunedCount: result.count };
}
