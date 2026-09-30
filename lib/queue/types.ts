export type JobType =
  | "GSC_SYNC"
  | "WEEKLY_DIGEST"
  | "QUOTA_RESET"
  | "INDEXING_PING";

export type JobStatus =
  | "QUEUED"
  | "ACTIVE"
  | "COMPLETED"
  | "FAILED"
  | "DEAD_LETTER";

export interface EnqueueOptions {
  priority?: number;
  maxAttempts?: number;
  backoffDelayMs?: number;
  runAt?: Date;
  projectId?: string;
  workspaceId?: string;
  forceMock?: boolean;
}

export interface JobRecord<T = Record<string, unknown>, R = unknown> {
  id: string;
  jobType: JobType | string;
  status: JobStatus | string;
  priority: number;
  payload: T;
  result: R | null;
  error: string | null;
  stackTrace: string | null;
  attempts: number;
  maxAttempts: number;
  backoffDelayMs: number;
  nextRunAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  projectId: string | null;
  workspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueStats {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  deadLetter: number;
  total: number;
}

export type JobHandler<T = any, R = any> = (
  payload: T,
  job: JobRecord<T, R>
) => Promise<R>;
