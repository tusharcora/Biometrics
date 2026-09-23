import type { ScoreConfig } from './configs/v1';
import type { Baseline, BaselineMetric, ConfidenceLevel, DailyPoint, ExplainedFactor, OutlierFlag, SleepSessionInput } from './types';
export interface PipelineInput {
    /** Day D: the civil date being scored. */
    date: string;
    hrv: DailyPoint[];
    rhr: DailyPoint[];
    /** Nightly minutesAsleep (the SLEEP rollup keyed by local end date). */
    sleep: DailyPoint[];
    steps: DailyPoint[];
    sleepGoalMinutes: number;
    /**
     * Stored SleepSession rows, for the Sleep Score's structural features
     * (efficiency, bedtime consistency). Omitted/empty means those two factors
     * are simply cold-starting; nothing in the Recovery Score reads them.
     */
    sessions?: SleepSessionInput[];
    /** IANA zone (User.timezone) sessions without their own UTC offset are read in. Defaults to UTC. */
    timezone?: string;
}
export interface FeatureValues {
    sleepDebtRolling14d: number | null;
    hrvBaselineDeviationPct: number | null;
    rhrBaselineDeviationPct: number | null;
    acuteChronicLoadRatio: number | null;
    hrvZ: number | null;
    hrvZImputed: boolean;
    rhrZ: number | null;
    rhrZImputed: boolean;
    sleepDurationZ: number | null;
    sleepDurationZImputed: boolean;
    sleepEfficiency: number | null;
    sleepEfficiencyZ: number | null;
    sleepEfficiencyZImputed: boolean;
    circadianConsistencyScore: number | null;
    circadianConsistencyZ: number | null;
    circadianConsistencyZImputed: boolean;
}
/** One composite's outcome: score, confidence and the explained factor vector. */
export interface ScoreOutcome {
    /** null when every factor is excluded (cold start). */
    score: number | null;
    confidenceLevel: ConfidenceLevel;
    factors: ExplainedFactor[];
}
export interface PipelineResult {
    date: string;
    algorithmVersion: string;
    /** False when none of HRV(D), RHR(D), SLEEP(D) was actually observed: there is nothing to score. */
    hasObservedInput: boolean;
    outlierFlags: {
        metric: 'HRV' | 'RESTING_HR';
        flag: OutlierFlag;
    }[];
    baselines: {
        metric: BaselineMetric;
        baseline: Baseline;
    }[];
    features: FeatureValues;
    /** The Recovery Score. */
    score: number | null;
    confidenceLevel: ConfidenceLevel;
    factors: ExplainedFactor[];
    /**
     * The Sleep Score. null when SLEEP(D) was not observed: a Sleep Score for a
     * day with no recorded sleep would be all imputed values, i.e. an invented
     * number, so none is produced (and a stale one is removed by the caller).
     */
    sleepScore: ScoreOutcome | null;
}
export declare function scoreDay(input: PipelineInput, cfg: ScoreConfig): PipelineResult;
//# sourceMappingURL=pipeline.d.ts.map