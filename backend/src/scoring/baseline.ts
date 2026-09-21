// Stage 3 -- Baseline model. Pure. Per-metric, per-user EWMA for the centre
// and a robust spread for the scale, replacing Phase 1's flat 30-day mean
// (fine for one dashboard sentence, not for a score someone tracks daily).

import type { ScoreConfig } from './configs/v1';
import type { Baseline, DailyPoint } from './types';

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of an empty series');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Raw (unscaled) median absolute deviation. Robust to the outliers Stage 1 didn't catch. */
export function mad(values: number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * EWMA_t = alpha * x_t + (1 - alpha) * EWMA_{t-1}, alpha = 2 / (N + 1), seeded
 * with the first value. Run over observations only: a gap day imputed from the
 * EWMA itself would leave it unchanged (alpha*e + (1-alpha)*e = e), so skipping
 * gaps and imputing them are the same thing at this level.
 */
export function ewma(values: number[], n: number): number | null {
  if (values.length === 0) return null;
  const alpha = 2 / (n + 1);
  let e = values[0]!;
  for (let i = 1; i < values.length; i++) e = alpha * values[i]! + (1 - alpha) * e;
  return e;
}

/**
 * `history` is ascending, cleaned, and already restricted by the caller to the
 * days strictly before the day being scored (inside cfg.historyDays). Fewer
 * than cfg.minHistoryDays observations is a cold start: the metric is excluded
 * for that user, never defaulted to a population figure, which would be a
 * fabricated per-user number.
 */
export function computeBaseline(history: DailyPoint[], cfg: ScoreConfig): Baseline {
  if (history.length < cfg.minHistoryDays) {
    return { coldStart: true, daysOfHistory: history.length };
  }
  const values = history.map((p) => p.value);
  const madValue = mad(values.slice(-cfg.spreadWindow));
  return {
    coldStart: false,
    daysOfHistory: history.length,
    ewma: ewma(values, cfg.ewmaN)!,
    // sigma-hat: k in Stage 4 is calibrated in standard deviations, and a raw
    // MAD under-reports sigma by ~1.4826 for normal-ish data.
    spread: cfg.madToSigma * madValue,
    mad: madValue,
  };
}

/** (value - ewma) / sigma-hat, with the spread floored (see ScoreConfig.spreadFloorFraction). Null while cold-starting. */
export function zScore(value: number, baseline: Baseline, cfg: ScoreConfig): number | null {
  if (baseline.coldStart) return null;
  const spread = Math.max(baseline.spread, cfg.spreadFloorFraction * Math.abs(baseline.ewma), Number.EPSILON);
  return (value - baseline.ewma) / spread;
}
