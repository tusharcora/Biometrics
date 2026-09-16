import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { BiometricMetricType } from '../types';

export interface FetchJobData {
  userId: string;
  metricType: BiometricMetricType;
  date: string; // YYYY-MM-DD
}

export interface BackfillJobData {
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const syncQueue = new Queue('health-sync', { connection });

export const TOKEN_REFRESH_SWEEP_JOB = 'tokenRefreshSweep';
export const TOKEN_REFRESH_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

export function enqueueFetchJob(data: FetchJobData) {
  return syncQueue.add('fetch', data);
}

export function enqueueBackfillJob(data: BackfillJobData) {
  return syncQueue.add('backfill', data);
}

/**
 * Schedules the token refresh sweep as a repeatable queue job rather than a
 * per-process setInterval. Without this, every backend instance would sweep
 * independently, sending redundant refresh calls to Google for the same
 * connections and fanning out avoidable rate-limited requests. BullMQ hands
 * each scheduled execution to exactly one worker across all processes.
 * Registration is idempotent: re-registering the same job id just updates
 * the existing schedule.
 */
export function scheduleTokenRefreshSweep() {
  return syncQueue.upsertJobScheduler(
    TOKEN_REFRESH_SWEEP_JOB,
    { every: TOKEN_REFRESH_SWEEP_INTERVAL_MS },
    { name: TOKEN_REFRESH_SWEEP_JOB },
  );
}

/**
 * The repeatable schedule's first run is one full interval away, so kick off a
 * single sweep at startup too. Also deduplicated by job id, so N instances
 * booting together still produce one sweep.
 */
export function enqueueImmediateTokenRefreshSweep() {
  return syncQueue.add(
    TOKEN_REFRESH_SWEEP_JOB,
    {},
    // BullMQ rejects a custom job id containing ':'.
    { jobId: `${TOKEN_REFRESH_SWEEP_JOB}-startup`, removeOnComplete: true },
  );
}
