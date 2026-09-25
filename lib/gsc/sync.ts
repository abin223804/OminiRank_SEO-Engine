import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { parseServiceAccountJson, getServiceAccountAccessToken } from "./jwt";
import { queryGscSearchAnalytics, generateMockGscAnalytics } from "./client";
import { classifyGscRows, calculateSnapshotMetrics } from "./classifier";
import { SyncResult } from "./types";

export interface SyncProjectOptions {
  startDate?: string;
  endDate?: string;
  allowMockFallback?: boolean;
  forceMock?: boolean;
}

/**
 * Executes a full Google Search Console ingestion and striking-distance
 * classification pipeline for a designated project.
 */
export async function syncProjectSearchConsole(
  projectId: string,
  options: SyncProjectOptions = {}
): Promise<SyncResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          queries: {
            select: {
              query: true,
              position: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found with ID '${projectId}'`);
  }

  // Build map of previous query rankings for delta calculation
  const previousQueriesMap = new Map<string, { position: number }>();
  if (project.snapshots.length > 0) {
    for (const q of project.snapshots[0].queries) {
      previousQueriesMap.set(q.query, { position: q.position });
    }
  }

  // Determine date ranges (default: last 28 days ending 3 days ago for GSC latency)
  const now = new Date();
  const end = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);

  const startDateStr = options.startDate || start.toISOString().split("T")[0];
  const endDateStr = options.endDate || end.toISOString().split("T")[0];

  let rawRows: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> = [];

  const useMock = options.forceMock || (!project.gscServiceAccountJsonEnc && (options.allowMockFallback ?? true));

  if (useMock) {
    const mockData = generateMockGscAnalytics(project.siteUrl);
    rawRows = mockData.rows || [];
  } else if (project.gscServiceAccountJsonEnc) {
    try {
      const plaintextJson = decryptSecret(project.gscServiceAccountJsonEnc);
      const credentials = parseServiceAccountJson(plaintextJson);
      const accessToken = await getServiceAccountAccessToken(credentials);

      const response = await queryGscSearchAnalytics(accessToken, {
        siteUrl: project.gscPropertyId,
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      });

      rawRows = response.rows || [];
    } catch (err) {
      if (options.allowMockFallback ?? true) {
        console.warn(
          `[GSC Sync Warning] Live GSC fetch failed: ${err instanceof Error ? err.message : "Unknown"}. Falling back to mock dataset.`
        );
        const mockData = generateMockGscAnalytics(project.siteUrl);
        rawRows = mockData.rows || [];
      } else {
        throw err;
      }
    }
  } else {
    throw new Error("Project has no GSC credentials configured and mock fallback is disabled.");
  }

  // 1. Classify queries and compute deltas
  const classifiedQueries = classifyGscRows(rawRows, project.siteUrl, previousQueriesMap);

  // 2. Compute aggregate metrics
  const metrics = calculateSnapshotMetrics(classifiedQueries);

  // 3. Atomically persist snapshot and ranked queries
  const result = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.searchSnapshot.create({
      data: {
        projectId: project.id,
        startDate: new Date(startDateStr),
        endDate: new Date(endDateStr),
        totalImpressions: metrics.totalImpressions,
        totalClicks: metrics.totalClicks,
        avgCtr: metrics.avgCtr,
        avgPosition: metrics.avgPosition,
        totalQueries: metrics.totalQueries,
      },
    });

    if (classifiedQueries.length > 0) {
      await tx.rankedQuery.createMany({
        data: classifiedQueries.map((q) => ({
          projectId: project.id,
          snapshotId: snapshot.id,
          query: q.query,
          pageUrl: q.pageUrl,
          impressions: q.impressions,
          clicks: q.clicks,
          ctr: q.ctr,
          position: q.position,
          isStrikingDistance: q.isStrikingDistance,
          positionDelta: q.positionDelta,
        })),
      });
    }

    return snapshot;
  });

  return {
    snapshotId: result.id,
    projectId: project.id,
    metrics,
    queriesCount: classifiedQueries.length,
    strikingDistanceCount: metrics.strikingDistanceCount,
  };
}
