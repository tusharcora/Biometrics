import type { Queue } from 'bullmq';
export declare const HABIT_CORRELATION_SWEEP_JOB = "habitCorrelationSweep";
export declare const RUN_HABIT_CORRELATIONS_JOB = "runHabitCorrelations";
/** Mondays 05:00 server time. Weekly on purpose: a week is the smallest amount of new data worth re-testing (nightly would be noise chasing noise). */
export declare const HABIT_CORRELATION_CRON = "0 5 * * 1";
export interface RunHabitCorrelationsJobData {
    userId: string;
    /** ISO week key, so a retry or a doubled schedule of the same week is recognisable. */
    runKey: string;
}
export type HabitJobQueue = Pick<Queue, 'add'>;
export type HabitSchedulerQueue = Pick<Queue, 'upsertJobScheduler'>;
/** Deterministic per user+week: BullMQ ignores an add() whose id already exists. (No ':' in a BullMQ custom id.) */
export declare function habitCorrelationJobId(userId: string, runKey: string): string;
export declare function enqueueHabitCorrelations(userId: string, runKey: string, { queue }?: {
    queue?: HabitJobQueue;
}): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
/** Registers the weekly sweep as a repeatable scheduler (idempotent, one execution across all instances). */
export declare function scheduleWeeklyHabitCorrelationSweep(queue?: HabitSchedulerQueue): Promise<import("bullmq").Job<any, any, string, import("bullmq").JobProgress>>;
//# sourceMappingURL=queue.d.ts.map