// Stage 2 -- Feature derivation. Pure functions over daily series; persistence
// into UserDailyFeatures happens in the orchestrator.

import { shiftDate } from './dates';
import type { ScoreConfig } from './configs/v1';
import type { DailyPoint } from './types';

/**
 * sleepDebtRolling14d = sum of max(0, sleepGoalMinutes - minutesAsleep) over
 * the window ending on `date` (inclusive). Each night is floored at 0, so a long
 * night does not pay back another night's deficit: it is a rolling deficit, not
 * a net balance.
 *
 * A night with no record contributes 0: absence of data is not evidence of a
 * full-goal deficit. (The caller flags that day's factor as imputed instead, so
 * confidence reflects it.)
 */
export function sleepDebtRolling(sleep: DailyPoint[], date: string, goalMinutes: number, cfg: ScoreConfig): number {
  const from = shiftDate(date, -(cfg.sleepDebtWindowDays - 1));
  let debt = 0;
  for (const night of sleep) {
    if (night.date >= from && night.date <= date) debt += Math.max(0, goalMinutes - night.value);
  }
  return debt;
}

/**
 * The daily sleep-debt series through `throughDate`, needed as the baseline
 * history for that factor. A day is emitted only when its whole window lies
 * inside the user's history (first recorded night + window - 1): earlier
 * windows are understated by construction and would drag the baseline low,
 * making every later day look like unusually high debt.
 */
export function buildSleepDebtSeries(
  sleep: DailyPoint[],
  throughDate: string,
  goalMinutes: number,
  cfg: ScoreConfig,
): DailyPoint[] {
  if (sleep.length === 0) return [];
  const firstNight = sleep.reduce((min, p) => (p.date < min ? p.date : min), sleep[0]!.date);
  const out: DailyPoint[] = [];
  for (let d = shiftDate(firstNight, cfg.sleepDebtWindowDays - 1); d <= throughDate; d = shiftDate(d, 1)) {
    out.push({ date: d, value: sleepDebtRolling(sleep, d, goalMinutes, cfg) });
  }
  return out;
}

/** Percent deviation of `value` from its EWMA baseline. */
export function baselineDeviationPct(value: number, ewma: number): number {
  return ((value - ewma) / ewma) * 100;
}

function meanOver(steps: DailyPoint[], from: string, to: string): { mean: number; count: number } {
  let sum = 0;
  let count = 0;
  for (const p of steps) {
    if (p.date >= from && p.date <= to) {
      sum += p.value;
      count++;
    }
  }
  return { mean: count === 0 ? 0 : sum / count, count };
}

/**
 * Steps-derived acute:chronic workload ratio (7-day mean / 28-day mean).
 * Computed and stored so the series exists to validate later, but deliberately
 * NOT part of the Recovery composite: a steps proxy is not a validated training
 * load, and a weighted term built on it would carry unvalidated input.
 */
export function acuteChronicLoadRatio(steps: DailyPoint[], date: string, cfg: ScoreConfig): number | null {
  const acute = meanOver(steps, shiftDate(date, -(cfg.acwr.acuteDays - 1)), date);
  const chronic = meanOver(steps, shiftDate(date, -(cfg.acwr.chronicDays - 1)), date);
  if (acute.count === 0 || chronic.count < cfg.acwr.minChronicObservations || chronic.mean === 0) return null;
  return acute.mean / chronic.mean;
}
