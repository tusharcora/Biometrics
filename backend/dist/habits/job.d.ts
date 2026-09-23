/** ISO-8601 week key ("2026-W38"): one run per user per week. */
export declare function isoWeekKey(date: Date): string;
export interface HabitRunOutcome {
    /** True when this run key had already been applied, so nothing was written. */
    skipped: boolean;
    tested: number;
    passed: number;
}
/**
 * The weekly run for one user: test every (habit, factor, lag), then apply the
 * persistence rule to the stored rows. Nothing is surfaced by this function;
 * a pass only advances a row toward CONFIRMED.
 *
 * Idempotent per `runKey` (the ISO week by default): every row this run writes
 * is stamped with the key, and a later run finding that stamp does nothing.
 * Without that, a BullMQ retry or a doubled schedule would count one week as
 * two consecutive passes and confirm a pattern on a single week's evidence.
 * All writes go in one transaction, so a crash cannot leave a half-applied run
 * that the stamp would then wrongly treat as complete.
 */
export declare function runHabitCorrelations(userId: string, { now, runKey }?: {
    now?: Date;
    runKey?: string;
}): Promise<HabitRunOutcome>;
//# sourceMappingURL=job.d.ts.map