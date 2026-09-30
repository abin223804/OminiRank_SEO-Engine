import { prisma } from "@/lib/prisma";
import { queueManager } from "./manager";

export interface CronRunOptions {
  drainQueue?: boolean;
  batchSize?: number;
  concurrency?: number;
  forceMock?: boolean;
}

export interface CronExecutionResult {
  cronName: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  durationMs: number;
  itemsCount: number;
  errorsCount: number;
  details?: Record<string, unknown>;
}

/**
 * Verify secret authentication for incoming cron requests
 */
export function verifyCronAuth(request: Request): boolean {
  const expectedSecret =
    process.env.CRON_SECRET || "omnirank_cron_secret_internal_test";

  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === expectedSecret) return true;
  }

  // 2. Check x-cron-secret header
  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader && customHeader.trim() === expectedSecret) {
    return true;
  }

  // 3. Check query param ?secret=
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret && querySecret.trim() === expectedSecret) {
    return true;
  }

  return false;
}

/**
 * Daily GSC Synchronization Cron (Runs 02:00 UTC)
 * Discovers all active tracking projects and enqueues automated GSC delta ingestion
 */
export async function runDailyGscSyncCron(
  options: CronRunOptions = {}
): Promise<CronExecutionResult> {
  const startTime = Date.now();
  let errorsCount = 0;
  const enqueuedJobIds: string[] = [];

  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        workspaceId: true,
        siteUrl: true,
      },
    });

    for (const project of projects) {
      try {
        const job = await queueManager.enqueue(
          "GSC_SYNC",
          {
            projectId: project.id,
            options: { forceMock: options.forceMock ?? true },
          },
          {
            priority: 5,
            projectId: project.id,
            workspaceId: project.workspaceId,
          }
        );
        enqueuedJobIds.push(job.id);
      } catch (err) {
        errorsCount++;
        console.error(`[Daily GSC Cron] Failed to enqueue project ${project.id}:`, err);
      }
    }

    // Optionally drain queue immediately
    if (options.drainQueue && enqueuedJobIds.length > 0) {
      await queueManager.processBatch(
        options.batchSize || enqueuedJobIds.length,
        options.concurrency || 3,
        "cron_daily_gsc"
      );
    }

    const durationMs = Date.now() - startTime;
    const status =
      errorsCount === 0
        ? "SUCCESS"
        : errorsCount < projects.length
        ? "PARTIAL"
        : "FAILED";

    const audit = await prisma.cronExecutionAudit.create({
      data: {
        cronName: "daily-gsc-sync",
        status,
        durationMs,
        itemsCount: projects.length,
        errorsCount,
        details: {
          enqueuedCount: enqueuedJobIds.length,
          jobIds: enqueuedJobIds.slice(0, 50),
        },
      },
    });

    return {
      cronName: "daily-gsc-sync",
      status,
      durationMs,
      itemsCount: projects.length,
      errorsCount,
      details: {
        auditId: audit.id,
        enqueuedCount: enqueuedJobIds.length,
      },
    };
  } catch (fatalError) {
    const durationMs = Date.now() - startTime;
    await prisma.cronExecutionAudit.create({
      data: {
        cronName: "daily-gsc-sync",
        status: "FAILED",
        durationMs,
        itemsCount: 0,
        errorsCount: 1,
        details: {
          error: fatalError instanceof Error ? fatalError.message : String(fatalError),
        },
      },
    });

    throw fatalError;
  }
}

/**
 * Weekly Executive Search Intelligence Digest Cron (Runs Mondays 08:00 UTC)
 * Aggregates week-over-week deltas and dispatches executive summaries via email
 */
export async function runWeeklyDigestCron(
  options: CronRunOptions = {}
): Promise<CronExecutionResult> {
  const startTime = Date.now();
  let errorsCount = 0;
  const scheduledJobIds: string[] = [];

  try {
    // Find projects belonging to active workspaces
    const projects = await prisma.project.findMany({
      include: {
        workspace: {
          select: {
            planTier: true,
          },
        },
      },
    });

    for (const project of projects) {
      try {
        const job = await queueManager.enqueue(
          "WEEKLY_DIGEST",
          {
            projectId: project.id,
            options: { forceMock: options.forceMock ?? true },
          },
          {
            priority: 8,
            projectId: project.id,
            workspaceId: project.workspaceId,
          }
        );
        scheduledJobIds.push(job.id);
      } catch (err) {
        errorsCount++;
        console.error(`[Weekly Digest Cron] Failed to enqueue project ${project.id}:`, err);
      }
    }

    if (options.drainQueue && scheduledJobIds.length > 0) {
      await queueManager.processBatch(
        options.batchSize || scheduledJobIds.length,
        options.concurrency || 2,
        "cron_weekly_digest"
      );
    }

    const durationMs = Date.now() - startTime;
    const status =
      errorsCount === 0
        ? "SUCCESS"
        : errorsCount < projects.length
        ? "PARTIAL"
        : "FAILED";

    const audit = await prisma.cronExecutionAudit.create({
      data: {
        cronName: "weekly-digest",
        status,
        durationMs,
        itemsCount: projects.length,
        errorsCount,
        details: {
          scheduledCount: scheduledJobIds.length,
        },
      },
    });

    return {
      cronName: "weekly-digest",
      status,
      durationMs,
      itemsCount: projects.length,
      errorsCount,
      details: {
        auditId: audit.id,
        scheduledCount: scheduledJobIds.length,
      },
    };
  } catch (fatalError) {
    const durationMs = Date.now() - startTime;
    await prisma.cronExecutionAudit.create({
      data: {
        cronName: "weekly-digest",
        status: "FAILED",
        durationMs,
        itemsCount: 0,
        errorsCount: 1,
        details: {
          error: fatalError instanceof Error ? fatalError.message : String(fatalError),
        },
      },
    });

    throw fatalError;
  }
}

/**
 * Monthly Quota Rollover & Audit Cron (Runs 1st of month 00:00 UTC)
 * Audits usage tallies and resets workspace counters
 */
export async function runMonthlyQuotaResetCron(
  options: CronRunOptions = {}
): Promise<CronExecutionResult> {
  const startTime = Date.now();
  let errorsCount = 0;

  try {
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        planTier: true,
      },
    });

    const job = await queueManager.enqueue(
      "QUOTA_RESET",
      {
        month: new Date().toISOString().slice(0, 7),
      },
      {
        priority: 10,
      }
    );

    if (options.drainQueue) {
      await queueManager.executeJob(job);
    }

    const durationMs = Date.now() - startTime;
    const audit = await prisma.cronExecutionAudit.create({
      data: {
        cronName: "monthly-quota-reset",
        status: "SUCCESS",
        durationMs,
        itemsCount: workspaces.length,
        errorsCount: 0,
        details: {
          workspacesCount: workspaces.length,
          jobId: job.id,
        },
      },
    });

    return {
      cronName: "monthly-quota-reset",
      status: "SUCCESS",
      durationMs,
      itemsCount: workspaces.length,
      errorsCount,
      details: {
        auditId: audit.id,
        jobId: job.id,
        workspacesCount: workspaces.length,
      },
    };
  } catch (fatalError) {
    const durationMs = Date.now() - startTime;
    await prisma.cronExecutionAudit.create({
      data: {
        cronName: "monthly-quota-reset",
        status: "FAILED",
        durationMs,
        itemsCount: 0,
        errorsCount: 1,
        details: {
          error: fatalError instanceof Error ? fatalError.message : String(fatalError),
        },
      },
    });

    throw fatalError;
  }
}
