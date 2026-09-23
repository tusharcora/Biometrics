import type { Queue } from 'bullmq';
export declare const COMPUTE_DAILY_SCORE_JOB = "computeDailyScore";
export declare const SCORE_SWEEP_JOB = "scoreSweep";
/** A burst of overnight sleep + HRV + RHR webhooks collapses into one recompute. */
export declare const SCORE_DEBOUNCE_MS: number;
/** 03:30 server time, nightly. A cron pattern (not `every`) so it stays at a fixed hour across restarts. */
export declare const SCORE_SWEEP_CRON = "30 3 * * *";
export interface ComputeDailyScoreJobData {
    userId: string;
    date: string;
}
/** The slice of a BullMQ Queue the enqueue helpers need. */
export type ScoreQueue = Pick<Queue, 'add'>;
export type ScoreSchedulerQueue = Pick<Queue, 'upsertJobScheduler'>;
/**
 * Deterministic per user+date. BullMQ ignores an add() whose jobId already
 * exists, which is what makes the debounce work: the second..Nth webhook in a
 * burst finds the delayed job already queued and is a no-op. (BullMQ rejects
 * ':' in a custom job id, hence the dashes.)
 */
export declare function scoreJobId(userId: string, date: string): string;
/**
 * Queue one recompute of (userId, date), debounced. The job is removed when it
 * finishes or fails: a retained job would keep its id occupied and silently
 * swallow every later enqueue for that day. Data arriving while the job is
 * running is picked up by the nightly sweep, the backstop for this window.
 */
export declare function enqueueScoreCompute(userId: string, date: string, { queue, delayMs }?: {
    queue?: ScoreQueue;
    delayMs?: number;
}): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
/** Registers the nightly sweep as a repeatable scheduler (idempotent, one execution across all instances). */
export declare function scheduleNightlyScoreSweep(queue?: ScoreSchedulerQueue): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
//# sourceMappingURL=queue.d.ts.map