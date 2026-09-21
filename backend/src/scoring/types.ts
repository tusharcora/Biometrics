// Shapes shared by the pure scoring stages. Nothing here touches the DB: the
// stages take plain series in and return plain values out, so each one can be
// unit-tested with synthetic data and replayed by the backtest tool.

/** One value for one civil date (YYYY-MM-DD), the same day key BiometricRecord uses. */
export interface DailyPoint {
  date: string;
  value: number;
}

/** The Recovery Score's weighted factors. */
export type RecoveryFactorKey = 'HRV' | 'RHR' | 'SLEEP_DEBT';

/** The Sleep Score's weighted factors (Slice 1.5). */
export type SleepFactorKey = 'SLEEP_DURATION' | 'SLEEP_EFFICIENCY' | 'CIRCADIAN_CONSISTENCY';

/** Every factor a DailyScore's vector can hold, across both score types. */
export type FactorKey = RecoveryFactorKey | SleepFactorKey;

/** A stored sleep session: the SleepSession columns the Sleep Score features read. */
export interface SleepSessionInput {
  startTime: Date;
  endTime: Date;
  minutesAsleep: number;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** Series names a baseline can be built for. Strings in the DB, so adding one needs no migration. */
export type BaselineMetric =
  | 'HRV'
  | 'RESTING_HR'
  | 'SLEEP'
  | 'SLEEP_DEBT'
  | 'SLEEP_EFFICIENCY'
  | 'CIRCADIAN_CONSISTENCY';

/** Stage 1: a value rejected as an outlier. The raw record is never altered; it is only skipped. */
export interface OutlierFlag {
  date: string;
  value: number;
  median: number;
  mad: number;
}

/** Stage 3 output. Cold-start means fewer than minHistoryDays observations: no stats, never a population default. */
export type Baseline =
  | { coldStart: true; daysOfHistory: number }
  | { coldStart: false; daysOfHistory: number; ewma: number; spread: number; mad: number };

/** Input to Stage 4 for one factor. `z` is the RAW z-score (not direction-corrected). */
export interface FactorInput {
  factor: FactorKey;
  z: number | null;
  imputed: boolean;
  excluded: boolean;
}

/** Stage 4 output per factor (before Stage 5 adds `points`). */
export interface FactorContribution {
  factor: FactorKey;
  z: number | null;
  /** The weight actually used that day, after renormalizing around excluded factors (0 when excluded). */
  weight: number;
  /** weight * direction * z. */
  contribution: number;
  imputed: boolean;
  excluded: boolean;
}

/** Stage 5 output per factor. */
export interface ExplainedFactor extends FactorContribution {
  /** This factor's proportional share of (score - 50). Sums to score - 50. */
  points: number;
}

export interface CompositeResult {
  /** null when every factor is excluded. */
  score: number | null;
  confidenceLevel: ConfidenceLevel;
  factors: FactorContribution[];
}
