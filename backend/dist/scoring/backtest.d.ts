import type { ScoreConfig } from './configs/v1';
import type { DailyPoint, SleepSessionInput } from './types';
/** Which composite a backtest replays. */
export type BacktestScoreType = 'RECOVERY' | 'SLEEP';
/** A day whose score moves by more than this is called out (spec §3: "flip more than 10 points"). */
export declare const CHANGE_THRESHOLD_POINTS = 10;
export declare const BACKTEST_DISCLAIMER: string;
export interface BacktestUserData {
    userId: string;
    hrv: DailyPoint[];
    rhr: DailyPoint[];
    sleep: DailyPoint[];
    steps: DailyPoint[];
    sleepGoalMinutes: number;
    /** Stored sessions (Sleep Score efficiency / bedtime consistency). Omitted means those factors cold-start. */
    sessions?: SleepSessionInput[];
    /** IANA zone sessions without their own UTC offset are read in. Defaults to UTC. */
    timezone?: string;
}
export interface DayDiff {
    userId: string;
    date: string;
    live: number | null;
    candidate: number | null;
    /** candidate - live; null when either side has no score (cold start under one version only). */
    delta: number | null;
}
export interface BacktestReport {
    type: BacktestScoreType;
    liveVersion: string;
    candidateVersion: string;
    days: DayDiff[];
    /** Days where both versions produced a score. */
    comparedDays: number;
    /** Days where |delta| > CHANGE_THRESHOLD_POINTS. */
    changedOverThreshold: number;
    /** Days scored under exactly one version. */
    scoredByOneVersionOnly: number;
    meanAbsDelta: number;
    maxAbsDelta: number;
}
/**
 * Replays one score type. Uses the SAME scoreDay for both, so the Recovery and
 * Sleep diffs come from the one pipeline the live job runs. A day contributes
 * to the SLEEP report only when a Sleep Score exists for it under the live
 * config (no observed sleep, no Sleep Score, as in the live job).
 */
export declare function backtest(users: BacktestUserData[], live: ScoreConfig, candidate: ScoreConfig, range: {
    from: string;
    to: string;
}, type?: BacktestScoreType): BacktestReport;
export declare function formatReport(report: BacktestReport, { maxRows }?: {
    maxRows?: number;
}): string;
//# sourceMappingURL=backtest.d.ts.map