import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { BiometricMetricType } from '../types';
export interface FetchJobData {
    userId: string;
    metricType: BiometricMetricType;
    date: string;
}
export interface BackfillJobData {
    userId: string;
    startDate: string;
    endDate: string;
}
export declare const connection: IORedis<"legacy">;
export declare const syncQueue: Queue<any, any, string, any, any, string, import("bullmq").RedisQueueBackend>;
export declare const TOKEN_REFRESH_SWEEP_JOB = "tokenRefreshSweep";
export declare const TOKEN_REFRESH_SWEEP_INTERVAL_MS: number;
export declare function enqueueFetchJob(data: FetchJobData): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
export declare function enqueueBackfillJob(data: BackfillJobData): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
export declare const STEPS_HISTORY_BACKFILL_JOB = "backfillStepsHistory";
export interface StepsHistoryBackfillJobData {
    userId: string;
}
/**
 * One job per user at a time: the job id dedupes a connect that races the
 * startup sweep. Removed on completion AND failure so the id is free again for
 * the next reconnect or server start (the job is idempotent either way).
 */
export declare function enqueueStepsHistoryBackfill(userId: string): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
/**
 * Schedules the token refresh sweep as a repeatable queue job rather than a
 * per-process setInterval. Without this, every backend instance would sweep
 * independently, sending redundant refresh calls to Google for the same
 * connections and fanning out avoidable rate-limited requests. BullMQ hands
 * each scheduled execution to exactly one worker across all processes.
 * Registration is idempotent: re-registering the same job id just updates
 * the existing schedule.
 */
export declare function scheduleTokenRefreshSweep(): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
/**
 * The repeatable schedule's first run is one full interval away, so kick off a
 * single sweep at startup too. Also deduplicated by job id, so N instances
 * booting together still produce one sweep.
 */
export declare function enqueueImmediateTokenRefreshSweep(): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
//# sourceMappingURL=queue.d.ts.map