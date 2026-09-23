import type { ScoreConfig } from './configs/v1';
export type ComputeOutcome = 'scored' | 'no-input' | 'no-user';
/**
 * The single scoring job: runs the five pure stages for one user-day and
 * persists BaselineSnapshot, UserDailyFeatures and both DailyScore rows
 * (RECOVERY, and SLEEP when the night was observed). Everything is an
 * upsert keyed on (user, date[, metric|type]), so recomputing is always safe
 * to repeat (BullMQ retries, a debounced webhook and the nightly sweep can all
 * land on the same day). It never short-circuits on an existing score, so a
 * row written by an older algorithm version is simply overwritten with the live
 * version's answer (the sweep enqueues such days as stale). It is one job, not
 * a flow: there is no network call and no stage that can fail independently of
 * the others.
 *
 * "Day D" is the civil date key BiometricRecord already uses, so HRV(D), RHR(D)
 * and the SLEEP rollup(D) are the same night (Slice 0).
 */
export declare function computeDailyScore(userId: string, date: string, opts?: {
    config?: ScoreConfig;
}): Promise<ComputeOutcome>;
//# sourceMappingURL=compute.d.ts.map