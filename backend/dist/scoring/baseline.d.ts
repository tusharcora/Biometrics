import type { ScoreConfig } from './configs/v1';
import type { Baseline, BaselineMetric, DailyPoint } from './types';
export declare function median(values: number[]): number;
/** Raw (unscaled) median absolute deviation. Robust to the outliers Stage 1 didn't catch. */
export declare function mad(values: number[]): number;
/**
 * EWMA_t = alpha * x_t + (1 - alpha) * EWMA_{t-1}, alpha = 2 / (N + 1), seeded
 * with the first value. Run over observations only: a gap day imputed from the
 * EWMA itself would leave it unchanged (alpha*e + (1-alpha)*e = e), so skipping
 * gaps and imputing them are the same thing at this level.
 */
export declare function ewma(values: number[], n: number): number | null;
/**
 * `history` is ascending, cleaned, and already restricted by the caller to the
 * days strictly before the day being scored (inside cfg.historyDays). Fewer
 * than cfg.minHistoryDays observations is a cold start: the metric is excluded
 * for that user, never defaulted to a population figure, which would be a
 * fabricated per-user number.
 */
export declare function computeBaseline(history: DailyPoint[], cfg: ScoreConfig): Baseline;
/**
 * (value - ewma) / sigma-hat, with the spread floored (see ScoreConfig.spreadFloorFraction
 * and, for `metric`, ScoreConfig.spreadFloors). Null while cold-starting. NOT clamped:
 * the composite applies cfg.zClamp, so this stays the raw z the features store.
 */
export declare function zScore(value: number, baseline: Baseline, cfg: ScoreConfig, metric?: BaselineMetric): number | null;
/**
 * The Sleep Score's duration z: how far a night sits from the user's sleep GOAL
 * (not from their own baseline), in units of their own sigma-hat.
 *
 *   z = clamp((minutesAsleep - goal) / sigma-hat, cfg.sleepScore.durationZClamp)
 *
 * sigma-hat comes from the SLEEP metric's Stage-3 baseline, so a variable
 * sleeper is judged more leniently per minute of shortfall than a regular one.
 * The clamp is asymmetric on purpose ([-3, +1]): sleeping past goal earns no
 * extra credit beyond +1 sigma, while a very short night is penalized down to
 * -3. Judging against the goal rather than the baseline also means a habitually
 * short sleeper is not rewarded for matching their own (short) norm.
 * Null while the SLEEP baseline is cold-starting: there is no sigma-hat yet.
 */
export declare function sleepDurationZVsGoal(minutesAsleep: number, goalMinutes: number, baseline: Baseline, cfg: ScoreConfig): number | null;
/** The duration z before its [-3, +1] clamp; recorded as `zRaw` for explainability. Null while cold-starting. */
export declare function sleepDurationZRawVsGoal(minutesAsleep: number, goalMinutes: number, baseline: Baseline, cfg: ScoreConfig): number | null;
//# sourceMappingURL=baseline.d.ts.map