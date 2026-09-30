import { queueManager } from "./manager";
import { logger } from "@/lib/logger";

export interface WorkerRunnerConfig {
  workerId?: string;
  concurrency?: number;
  pollIntervalMs?: number;
  batchSize?: number;
}

let isRunning = false;
let shouldStop = false;
let activeLoopPromise: Promise<void> | null = null;

/**
 * Starts the standalone background worker loop
 */
export async function startWorkerDaemon(config: WorkerRunnerConfig = {}): Promise<void> {
  if (isRunning) {
    logger.warn("Worker daemon is already active.");
    return;
  }

  isRunning = true;
  shouldStop = false;

  const workerId = config.workerId || `pod_worker_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;
  const concurrency = config.concurrency || parseInt(process.env.WORKER_CONCURRENCY || "4", 10);
  const pollIntervalMs = config.pollIntervalMs || parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);
  const batchSize = config.batchSize || concurrency * 2;

  logger.info(`[Worker Daemon] Starting standalone worker '${workerId}' (concurrency=${concurrency}, poll=${pollIntervalMs}ms)`);

  const loop = async () => {
    let idleCycles = 0;

    while (!shouldStop) {
      try {
        const processed = await queueManager.processBatch(batchSize, concurrency, workerId);

        if (processed.length > 0) {
          idleCycles = 0;
          logger.info(`[Worker Daemon] Processed ${processed.length} jobs in batch`);
        } else {
          idleCycles++;
          if (idleCycles % 30 === 0) {
            // Heartbeat every ~60s of idle
            logger.debug(`[Worker Daemon] Heartbeat: idle, listening for queue jobs...`);
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      } catch (err: any) {
        logger.error(`[Worker Daemon] Loop error: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, Math.max(pollIntervalMs, 2000)));
      }
    }

    isRunning = false;
    logger.info(`[Worker Daemon] Stopped cleanly.`);
  };

  activeLoopPromise = loop();
}

/**
 * Gracefully signals the worker daemon to finish current batch and exit
 */
export async function stopWorkerDaemon(): Promise<void> {
  shouldStop = true;
  if (activeLoopPromise) {
    await activeLoopPromise;
  }
  isRunning = false;
}

/**
 * Direct CLI invocation hook
 */
if (typeof require !== "undefined" && require.main === module) {
  const handleSignal = async (signal: string) => {
    logger.info(`[Worker Daemon] Received ${signal}. Initiating graceful drain...`);
    await stopWorkerDaemon();
    process.exit(0);
  };

  process.on("SIGTERM", () => handleSignal("SIGTERM"));
  process.on("SIGINT", () => handleSignal("SIGINT"));

  startWorkerDaemon().catch((err) => {
    logger.error(`[Worker Daemon] Fatal startup error: ${err.message}`);
    process.exit(1);
  });
}
