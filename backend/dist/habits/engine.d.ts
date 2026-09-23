import type { ObservedDay } from './observed';
/**
 * The per-night z-score series the engine tests against. Deliberately NOT
 * sleepDebtRolling14d: a 14-day rolling sum smears one night's effect across
 * two weeks, so lags 1-3 cannot be told apart. The per-night sleepDurationZ is
 * the right series for lag testing.
 */
export type FactorKey = 'HRV' | 'RHR' | 'SLEEP_DURATION' | 'SLEEP_EFFICIENCY' | 'CIRCADIAN_CONSISTENCY';
export declare const CORRELATION_FACTORS: readonly FactorKey[];
/** One civil date of one factor. */
export interface FactorDay {
    /** null while the metric is cold-starting. */
    z: number | null;
    /**
     * The value was filled in from the baseline (z ~ 0 by construction), not
     * observed. Such a day is dropped from pairing: keeping it would pull every
     * correlation toward zero.
     */
    imputed: boolean;
    /** That day's % deviation from its baseline, for effectSizePercent. null when not derivable. */
    pct: number | null;
}
export type FactorSeries = ReadonlyMap<string, FactorDay>;
export interface HabitObservations {
    habitType: string;
    observations: ObservedDay[];
}
export interface EngineInput {
    habits: HabitObservations[];
    factors: Partial<Record<FactorKey, FactorSeries>>;
}
export interface SparklineSeries {
    /** Habit days (the day the habit happened; the factor is read `lagDays` later). */
    days: string[];
    habit: number[];
    factor: (number | null)[];
}
export interface HypothesisResult {
    habitType: string;
    factor: FactorKey;
    lagDays: number;
    r: number;
    pValue: number;
    qValue: number;
    nEff: number;
    sampleSize: number;
    exposedPairs: number;
    unexposedPairs: number;
    effectSizePercent: number | null;
    comparisonPercent: number | null;
    direction: 'higher' | 'lower';
    series: SparklineSeries;
    /** Survives BH at q < FDR_Q AND |r| > MIN_ABS_R. */
    passes: boolean;
}
export interface NotEnoughData {
    habitType: string;
    exposedDays: number;
    unexposedDays: number;
    requiredEach: number;
}
export interface EngineOutput {
    /** Every hypothesis that cleared the observation gate and was tested. */
    hypotheses: HypothesisResult[];
    /** Habits with no testable (factor, lag): reported with counts, never silently dropped. */
    notEnoughData: NotEnoughData[];
}
/**
 * The min-observation gate on its own: for each habit, the observed exposed /
 * unexposed pair counts at the best (factor, lag), and whether ANY (factor, lag)
 * clears the gate. Runs no correlation, p-value or BH step. analyzeHabits'
 * notEnoughData is exactly this, so the two can never disagree.
 */
export declare function computeNotEnoughData(input: EngineInput): NotEnoughData[];
export declare function analyzeHabits(input: EngineInput): EngineOutput;
//# sourceMappingURL=engine.d.ts.map