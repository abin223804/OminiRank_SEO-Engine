import { prisma } from "@/lib/prisma";
import {
  EnqueueOptions,
  JobHandler,
  JobRecord,
  JobStatus,
  JobType,
  QueueStats,
} from "./types";
import { jobHandlers } from "./handlers";

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

export class QueueManager {
  private customHandlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;

  constructor() {
    // Register built-in handlers
    for (const [type, handler] of Object.entries(jobHandlers)) {
      this.customHandlers.set(type, handler);
    }
  }

  /**
   * Register or override a handler for a specific job type
   */
  public registerHandler<T = any, R = any>(
    jobType: string,
    handler: JobHandler<T, R>
  ): void {
    this.customHandlers.set(jobType, handler);
  }

  /**
   * Enqueue a new background task
   */
  public async enqueue<T extends Record<string, unknown> = Record<string, unknown>>(
    jobType: JobType | string,
    payload: T,
    options: EnqueueOptions = {}
  ): Promise<JobRecord<T>> {
    const rawProjectId = options.projectId || (payload.projectId as string) || null;
    const rawWorkspaceId = options.workspaceId || (payload.workspaceId as string) || null;

    const projectId = isValidObjectId(rawProjectId) ? rawProjectId : null;
    const workspaceId = isValidObjectId(rawWorkspaceId) ? rawWorkspaceId : null;

    const job = await prisma.backgroundJob.create({
      data: {
        jobType,
        status: "QUEUED",
        priority: options.priority ?? 0,
        payload: payload as any,
        maxAttempts: options.maxAttempts ?? 3,
        backoffDelayMs: options.backoffDelayMs ?? 1000,
        nextRunAt: options.runAt ?? new Date(),
        projectId,
        workspaceId,
      },
    });

    return job as unknown as JobRecord<T>;
  }

  /**
   * Atomically acquire the next queued job eligible for execution
   */
  public async acquireNextJob(
    workerId: string = "worker_default",
    maxLockRetries: number = 5
  ): Promise<JobRecord | null> {
    for (let attempt = 0; attempt < maxLockRetries; attempt++) {
      const now = new Date(Date.now() + 500); // Allow 500ms jitter margin
      const staleLockThreshold = new Date(Date.now() - 60 * 1000); // 60s stale lock

      // Find candidate queued job
      const candidate = await prisma.backgroundJob.findFirst({
        where: {
          status: "QUEUED",
          nextRunAt: { lte: now },
        },
        orderBy: [
          { priority: "desc" },
          { nextRunAt: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (!candidate) {
        return null;
      }

      // If candidate has an active unexpired lock, skip to avoid contention
      if (candidate.lockedAt && candidate.lockedAt.getTime() > staleLockThreshold.getTime()) {
        continue;
      }

      // Atomically lock and transition to ACTIVE using updateMany
      try {
        const lockResult = await prisma.backgroundJob.updateMany({
          where: {
            id: candidate.id,
            status: "QUEUED",
          },
          data: {
            status: "ACTIVE",
            lockedAt: now,
            lockedBy: workerId,
            startedAt: now,
          },
        });

        if (lockResult.count === 0) {
          // Race condition: another concurrent worker claimed this candidate in the same millisecond.
          // Retry next available candidate in the loop!
          continue;
        }

        const lockedJob = await prisma.backgroundJob.findUnique({
          where: { id: candidate.id },
        });

        return lockedJob as unknown as JobRecord;
      } catch (err) {
        console.error("[Queue Lock Error]", err);
        return null;
      }
    }

    return null;
  }

  /**
   * Execute a single acquired job with error trapping, backoff, and DLQ transition
   */
  public async executeJob(job: JobRecord): Promise<JobRecord> {
    const handler = this.customHandlers.get(job.jobType);

    if (!handler) {
      const errorMsg = `No registered job handler for jobType '${job.jobType}'`;
      const failedJob = await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "DEAD_LETTER",
          error: errorMsg,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          attempts: { increment: 1 },
        },
      });
      return failedJob as unknown as JobRecord;
    }

    try {
      const result = await handler(job.payload, job);

      const completedJob = await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          result: (result !== undefined ? result : { success: true }) as any,
          error: null,
          stackTrace: null,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });

      return completedJob as unknown as JobRecord;
    } catch (err) {
      const nextAttempt = job.attempts + 1;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const stackTrace = err instanceof Error ? err.stack : undefined;

      if (nextAttempt >= job.maxAttempts) {
        // Exceeded max retry attempts -> Dead-Letter Queue
        const dlqJob = await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "DEAD_LETTER",
            attempts: nextAttempt,
            error: errorMsg,
            stackTrace: stackTrace || null,
            completedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
          },
        });
        return dlqJob as unknown as JobRecord;
      } else {
        // Exponential backoff: delay = backoffDelayMs * (2 ^ (attempt - 1))
        const delay = job.backoffDelayMs * Math.pow(2, nextAttempt - 1);
        const nextRunAt = new Date(Date.now() + delay);

        const retryingJob = await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            attempts: nextAttempt,
            nextRunAt,
            error: errorMsg,
            stackTrace: stackTrace || null,
            lockedAt: null,
            lockedBy: null,
          },
        });
        return retryingJob as unknown as JobRecord;
      }
    }
  }

  /**
   * Acquire and process the next available job
   */
  public async processNext(workerId: string = "worker_default"): Promise<JobRecord | null> {
    const job = await this.acquireNextJob(workerId);
    if (!job) {
      return null;
    }
    return this.executeJob(job);
  }

  /**
   * Process a batch of jobs with controlled concurrency
   */
  public async processBatch(
    batchSize: number = 10,
    concurrency: number = 3,
    workerId: string = "worker_batch"
  ): Promise<JobRecord[]> {
    const processed: JobRecord[] = [];
    let remaining = batchSize;

    while (remaining > 0) {
      const takeCount = Math.min(remaining, concurrency);
      const promises: Promise<JobRecord | null>[] = [];

      for (let i = 0; i < takeCount; i++) {
        promises.push(this.processNext(`${workerId}_${i}`));
      }

      const results = await Promise.all(promises);
      const validResults = results.filter((r): r is JobRecord => r !== null);

      if (validResults.length === 0) {
        // No more eligible jobs in queue
        break;
      }

      processed.push(...validResults);
      remaining -= validResults.length;
    }

    return processed;
  }

  /**
   * Redrive a job from DEAD_LETTER or FAILED back to QUEUED
   */
  public async redriveJob(jobId: string): Promise<JobRecord> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job '${jobId}' not found`);
    }

    const resetJob = await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        attempts: 0,
        error: null,
        stackTrace: null,
        nextRunAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        startedAt: null,
        completedAt: null,
      },
    });

    return resetJob as unknown as JobRecord;
  }

  /**
   * Get real-time queue metrics
   */
  public async getStats(): Promise<QueueStats> {
    const [queued, active, completed, failed, deadLetter] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: "QUEUED" } }),
      prisma.backgroundJob.count({ where: { status: "ACTIVE" } }),
      prisma.backgroundJob.count({ where: { status: "COMPLETED" } }),
      prisma.backgroundJob.count({ where: { status: "FAILED" } }),
      prisma.backgroundJob.count({ where: { status: "DEAD_LETTER" } }),
    ]);

    return {
      queued,
      active,
      completed,
      failed,
      deadLetter,
      total: queued + active + completed + failed + deadLetter,
    };
  }

  /**
   * Retrieve a job by ID
   */
  public async getJob(jobId: string): Promise<JobRecord | null> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    return job as unknown as JobRecord | null;
  }

  /**
   * List jobs by project
   */
  public async getProjectJobs(projectId: string, limit: number = 20): Promise<JobRecord[]> {
    const jobs = await prisma.backgroundJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return jobs as unknown as JobRecord[];
  }
}

// Global singleton instance
declare global {
  // eslint-disable-next-line no-var
  var __omniRankQueueManager: QueueManager | undefined;
}

export const queueManager =
  global.__omniRankQueueManager || new QueueManager();

if (process.env.NODE_ENV !== "production") {
  global.__omniRankQueueManager = queueManager;
}
