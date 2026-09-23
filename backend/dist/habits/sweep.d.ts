import { HabitJobQueue } from './queue';
export interface HabitSweepSummary {
    usersEnqueued: number;
}
/**
 * The weekly fan-out: one runHabitCorrelations job per user who has ever
 * logged a habit or checked in, or who still has a stored correlation row (a
 * user who stopped logging must still have their rows age toward RETIRED
 * rather than stay CONFIRMED forever). Per-user jobs, not one big loop, so one
 * user's failure retries alone.
 */
export declare function runHabitCorrelationSweep({ queue, now, }?: {
    queue?: HabitJobQueue;
    now?: Date;
}): Promise<HabitSweepSummary>;
//# sourceMappingURL=sweep.d.ts.map