import { ScoreQueue } from './queue';
/** How far back the sweep back-fills missing scores. */
export declare const SWEEP_LOOKBACK_DAYS = 90;
export interface SweepSummary {
    usersChecked: number;
    jobsEnqueued: number;
}
/**
 * The correctness backstop behind the debounced per-webhook trigger: finds every
 * (user, date) in the lookback window that has score inputs but either no
 * score (a missed debounce, a first run, a day back-filled after the fact) or a
 * score older than the newest input's syncedAt, and enqueues the same single
 * computeDailyScore job for it. Delay 0: the sweep is already the slow path,
 * and the deterministic job id still collapses it into a job the webhook path
 * queued a moment earlier.
 *
 * Both score types are covered by that one job, so a day is enqueued when
 * EITHER is missing or stale (stale includes "scored by a version other than
 * LIVE_VERSION", so flipping the live version re-scores every day in the
 * lookback window over the following sweeps):
 *  - RECOVERY is expected for any day with an HRV, RESTING_HR or SLEEP input;
 *  - SLEEP is expected only for a day with a SLEEP input (a day with just HRV
 *    never gets a Sleep Score, so it must not be re-enqueued forever for
 *    lacking one). Its input is the SLEEP rollup, whose syncedAt is bumped on
 *    every session upsert.
 */
export declare function runScoreSweep({ queue, now, lookbackDays, }?: {
    queue?: ScoreQueue;
    now?: Date;
    lookbackDays?: number;
}): Promise<SweepSummary>;
//# sourceMappingURL=sweep.d.ts.map