import { syncProjectSearchConsole, SyncProjectOptions } from "@/lib/gsc/sync";
import { sendExecutiveDigest, DigestSendOptions } from "@/lib/email/digest";
import { pingSitemap, notifyUrlIndexing, SitemapPingOptions } from "@/lib/gsc/sitemap";
import { prisma } from "@/lib/prisma";
import { JobHandler, JobRecord } from "./types";

export interface GscSyncPayload {
  projectId: string;
  options?: SyncProjectOptions;
}

export interface WeeklyDigestPayload {
  projectId: string;
  options?: DigestSendOptions;
}

export interface QuotaResetPayload {
  workspaceId?: string;
  month?: string;
}

export interface IndexingPingPayload {
  projectId: string;
  targetUrls?: string[];
  options?: SitemapPingOptions;
}

export const jobHandlers: Record<string, JobHandler<any, any>> = {
  GSC_SYNC: async (payload: GscSyncPayload, _job: JobRecord) => {
    if (!payload.projectId) {
      throw new Error("Missing required 'projectId' in GSC_SYNC payload");
    }
    const result = await syncProjectSearchConsole(payload.projectId, payload.options || {});
    return result;
  },

  WEEKLY_DIGEST: async (payload: WeeklyDigestPayload, _job: JobRecord) => {
    if (!payload.projectId) {
      throw new Error("Missing required 'projectId' in WEEKLY_DIGEST payload");
    }
    const result = await sendExecutiveDigest(payload.projectId, payload.options || {});
    return result;
  },

  QUOTA_RESET: async (payload: QuotaResetPayload, _job: JobRecord) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const whereClause = payload.workspaceId ? { id: payload.workspaceId } : {};
    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        planTier: true,
      },
    });

    const resetAudit = {
      executionTime: new Date().toISOString(),
      workspacesProcessed: workspaces.length,
      month: payload.month || startOfMonth.toISOString().slice(0, 7),
    };

    return resetAudit;
  },

  INDEXING_PING: async (payload: IndexingPingPayload, _job: JobRecord) => {
    if (!payload.projectId) {
      throw new Error("Missing required 'projectId' in INDEXING_PING payload");
    }

    const sitemapRes = await pingSitemap(payload.projectId, payload.options || {});
    let indexingRes = null;
    if (payload.targetUrls && payload.targetUrls.length > 0) {
      indexingRes = await notifyUrlIndexing(
        payload.projectId,
        payload.targetUrls,
        payload.options || {}
      );
    }

    return {
      sitemap: sitemapRes,
      indexing: indexingRes,
    };
  },
};
