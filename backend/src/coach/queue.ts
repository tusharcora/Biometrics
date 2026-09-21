import type { Queue } from 'bullmq';
import { syncQueue } from '../sync/queue';

// Wired exactly like the nightly score sweep and the weekly habit sweep: the
// coach's scheduled jobs are repeatable schedulers on the existing
// 'health-sync' queue, dispatched in sync/worker.ts, and the queue is a
// parameter so tests hand in a fake instead of needing a live worker or Redis.

export const COACH_WEEKLY_DIGEST_JOB = 'coachWeeklyDigest';
export const COACH_RETENTION_JOB = 'coachRetentionSweep';

/**
 * Mondays 08:00 server time, after the Monday 05:00 habit correlation run so the
 * recap sees freshly confirmed patterns. One digest per user per local week is
 * enforced in the job itself, so a doubled or late tick is harmless.
 */
export const COACH_WEEKLY_DIGEST_CRON = '0 8 * * 1';

/** 04:15 server time, daily. */
export const COACH_RETENTION_CRON = '15 4 * * *';

export type CoachSchedulerQueue = Pick<Queue, 'upsertJobScheduler'>;

/** Idempotent; BullMQ hands each tick to exactly one worker across all instances. */
export function scheduleWeeklyCoachDigest(queue: CoachSchedulerQueue = syncQueue) {
  return queue.upsertJobScheduler(
    COACH_WEEKLY_DIGEST_JOB,
    { pattern: COACH_WEEKLY_DIGEST_CRON },
    { name: COACH_WEEKLY_DIGEST_JOB },
  );
}

export function scheduleDailyCoachRetention(queue: CoachSchedulerQueue = syncQueue) {
  return queue.upsertJobScheduler(
    COACH_RETENTION_JOB,
    { pattern: COACH_RETENTION_CRON },
    { name: COACH_RETENTION_JOB },
  );
}
