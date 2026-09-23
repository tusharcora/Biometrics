import type { Queue } from 'bullmq';
export declare const COACH_WEEKLY_DIGEST_JOB = "coachWeeklyDigest";
export declare const COACH_RETENTION_JOB = "coachRetentionSweep";
/**
 * Mondays 08:00 server time, after the Monday 05:00 habit correlation run so the
 * recap sees freshly confirmed patterns. One digest per user per local week is
 * enforced in the job itself, so a doubled or late tick is harmless.
 */
export declare const COACH_WEEKLY_DIGEST_CRON = "0 8 * * 1";
/** 04:15 server time, daily. */
export declare const COACH_RETENTION_CRON = "15 4 * * *";
export type CoachSchedulerQueue = Pick<Queue, 'upsertJobScheduler'>;
/** Idempotent; BullMQ hands each tick to exactly one worker across all instances. */
export declare function scheduleWeeklyCoachDigest(queue?: CoachSchedulerQueue): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
export declare function scheduleDailyCoachRetention(queue?: CoachSchedulerQueue): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
//# sourceMappingURL=queue.d.ts.map