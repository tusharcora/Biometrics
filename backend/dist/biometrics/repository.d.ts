import { BiometricMetricType, HealthMetricPoint, SleepSessionPoint } from '../types';
export declare function upsertBiometricRecords(userId: string, metricType: BiometricMetricType, points: HealthMetricPoint[]): Promise<void>;
/** As upsertSleepSessionsTouched, returning only the end instants. */
export declare function upsertSleepSessions(userId: string, sessions: SleepSessionPoint[]): Promise<Date[]>;
/**
 * Recomputes the SLEEP BiometricRecord rollup for each given local civil date
 * (YYYY-MM-DD in the user's timezone) from the FULL stored session set.
 * A fetch that only returned part of a day's sessions therefore can never
 * lower a total below what the stored sessions support.
 */
export declare function recomputeSleepRollups(userId: string, civilDates: string[]): Promise<void>;
/**
 * Rebuilds every SLEEP rollup for a user from scratch under their current
 * timezone. Used when the timezone changes: rollups keyed under the old zone
 * are dropped and the sessions re-bucketed, which is cheap because rollups
 * are derived. Sessions that carry their own UTC offset are keyed by it, so
 * they do not move with the timezone.
 */
export declare function recomputeAllSleepRollups(userId: string): Promise<string[]>;
/**
 * Upsert a batch of sessions, then refresh the rollup of every local date it
 * touched. Returns those dates so the caller can ask for the affected scores to
 * be recomputed.
 */
export declare function storeSleepSessions(userId: string, sessions: SleepSessionPoint[]): Promise<string[]>;
/**
 * The days whose scores a set of changed sleep nights invalidates.
 *
 * A night is not only an input to its own day: sleepDebtRolling sums the
 * deficit over a trailing window, so night D is still inside the window of
 * every day up to D + windowDays - 1. Returning only the touched dates meant a
 * late webhook, a reconnect backfill or a night Google revised re-scored day D
 * alone and left the following two weeks computed from a window that no longer
 * matched the data. The nightly sweep does not catch it either: its staleness
 * test is per day, and those days' own inputs never changed.
 *
 * Nothing is emitted past today -- there is no score to recompute for a day
 * that has not happened.
 */
export declare function datesNeedingRescore(touchedDates: string[], today?: string): string[];
export declare function getBiometricsForUser(userId: string): Promise<{
    id: string;
    metricType: import(".prisma/client").$Enums.BiometricMetricType;
    value: number;
    recordedAt: Date;
}[]>;
//# sourceMappingURL=repository.d.ts.map