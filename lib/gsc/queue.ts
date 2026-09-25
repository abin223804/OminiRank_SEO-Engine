import { syncProjectSearchConsole, SyncProjectOptions } from "./sync";
import { SyncResult } from "./types";

export type JobStatus = "queued" | "active" | "completed" | "failed";

export interface SyncJob {
  id: string;
  projectId: string;
  options: SyncProjectOptions;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: SyncResult;
  error?: string;
}

/**
 * In-process asynchronous queue worker with status tracking.
 * Provides resilient job execution with graceful fallback when external Redis is offline.
 */
class GscSyncQueue {
  private jobs: Map<string, SyncJob> = new Map();
  private isProcessing = false;
  private queue: string[] = [];

  public enqueue(projectId: string, options: SyncProjectOptions = {}): SyncJob {
    const jobId = `gsc_sync_${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: SyncJob = {
      id: jobId,
      projectId,
      options,
      status: "queued",
      createdAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    // Kick off worker loop asynchronously
    this.processNext().catch((err) => {
      console.error("[Queue Worker Error]", err);
    });

    return job;
  }

  public getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  public getProjectJobs(projectId: string): SyncJob[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const jobId = this.queue.shift();
    if (!jobId) {
      this.isProcessing = false;
      return;
    }

    const job = this.jobs.get(jobId);
    if (!job) {
      this.isProcessing = false;
      return;
    }

    job.status = "active";
    job.startedAt = Date.now();

    try {
      const result = await syncProjectSearchConsole(job.projectId, job.options);
      job.status = "completed";
      job.completedAt = Date.now();
      job.result = result;
    } catch (error) {
      job.status = "failed";
      job.completedAt = Date.now();
      job.error = error instanceof Error ? error.message : "Sync processing failed";
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

// Global singleton instance for the process
declare global {
  // eslint-disable-next-line no-var
  var __gscSyncQueue: GscSyncQueue | undefined;
}

export const syncQueue = global.__gscSyncQueue || new GscSyncQueue();
if (process.env.NODE_ENV !== "production") {
  global.__gscSyncQueue = syncQueue;
}
