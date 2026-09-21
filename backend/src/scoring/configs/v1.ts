import type { FactorKey } from '../types';

/**
 * Scoring algorithm v1. Versioned configs are NEVER mutated in place: a change
 * of weights, k or thresholds is a new file (v2.ts) registered in ./index.ts,
 * so any stored DailyScore can be reproduced from its algorithmVersion and the
 * backtest tool can diff two versions.
 *
 * The weights are an illustrative starting point, not derived from outcome
 * data (there is no ground-truth "recovery" label to fit them to). The
 * backtest shows what a change DOES, not whether it is CORRECT.
 */
export interface ScoreConfig {
  version: string;
  /** Base weights; they sum to 1 and are renormalized per day around excluded factors. */
  weights: Record<FactorKey, number>;
  /** +1: higher z helps recovery (HRV). -1: higher z hurts it (RHR, sleep debt). */
  direction: Record<FactorKey, 1 | -1>;
  /**
   * Logistic steepness in score = 100 / (1 + e^(-k * sum(w*z))). ln(9)/2 puts
   * all-z-zero at 50 and a favorable +2 sigma at exactly 90, since
   * 1 / (1 + e^(-ln 9)) = 0.9.
   */
  k: number;
  /** EWMA span N: alpha = 2 / (N + 1). */
  ewmaN: number;
  /** Fewer clean observations than this and a metric is excluded (cold-start). */
  minHistoryDays: number;
  /** Days of prior history the baseline sees. */
  historyDays: number;
  /** Observations the rolling MAD (spread) is computed over. */
  spreadWindow: number;
  /** MAD -> sigma consistency constant for normally distributed data. */
  madToSigma: number;
  /**
   * Spread never goes below this fraction of |ewma| when z-scoring. A perfectly
   * flat series has MAD 0, which would make any deviation an infinite z and
   * pin the score to 0 or 100.
   */
  spreadFloorFraction: number;
  outlier: {
    /** Reject a value more than this many raw MADs from the trailing median. */
    madMultiplier: number;
    windowDays: number;
    /** Below this many prior points there is no meaningful median/MAD, so nothing is rejected. */
    minHistory: number;
  };
  sleepDebtWindowDays: number;
  /** Steps-derived ACWR windows. Computed and stored, never part of the composite. */
  acwr: { acuteDays: number; chronicDays: number; minChronicObservations: number };
}

export const v1Config: ScoreConfig = {
  version: 'v1',
  weights: { HRV: 0.45, RHR: 0.35, SLEEP_DEBT: 0.2 },
  direction: { HRV: 1, RHR: -1, SLEEP_DEBT: -1 },
  k: Math.log(9) / 2,
  ewmaN: 30,
  minHistoryDays: 14,
  historyDays: 90,
  spreadWindow: 30,
  madToSigma: 1.4826,
  spreadFloorFraction: 0.02,
  outlier: { madMultiplier: 5, windowDays: 90, minHistory: 14 },
  sleepDebtWindowDays: 14,
  acwr: { acuteDays: 7, chronicDays: 28, minChronicObservations: 14 },
};
