import type { ScoreConfig } from './configs/v1';
import type { CompositeResult, FactorInput, FactorKey } from './types';
/** The per-factor weights and directions of one score type. The config itself is the Recovery model. */
export interface CompositeModel {
    weights: Partial<Record<FactorKey, number>>;
    direction: Partial<Record<FactorKey, 1 | -1>>;
}
/** Logistic squashing into (0, 100): a zero weighted sum is 50, and k sets how fast it saturates. */
export declare function logistic(weightedSum: number, k: number): number;
/**
 * `model` picks which score is being computed: it defaults to the Recovery
 * weights on `cfg`, and the Sleep Score passes `cfg.sleepScore`. Everything else
 * (k, the logistic, renormalization, confidence) is shared.
 *
 * Under a config with a zClamp every factor's z is clamped BEFORE weighting (and
 * so before it can influence anything else), the clamped z is what is stored and
 * summed (contribution = weight * direction * z stays exactly true), and the
 * unclamped one is kept as `zRaw`. Exclusion and renormalization depend only on
 * whether a z exists, never its size, so the weights still sum to 1.
 */
export declare function computeComposite(inputs: FactorInput[], cfg: ScoreConfig, model?: CompositeModel): CompositeResult;
//# sourceMappingURL=composite.d.ts.map