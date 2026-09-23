import type { CompositeResult, ExplainedFactor } from './types';
/** The score a day with no signal (all z = 0) lands on. */
export declare const NEUTRAL_SCORE = 50;
/**
 * points_i = contribution_i / sum(contribution) * (score - 50), so the points
 * sum exactly to score - 50. Sorted by contribution magnitude, largest first
 * (excluded factors, at 0, land last).
 */
export declare function explainFactors(result: CompositeResult): ExplainedFactor[];
//# sourceMappingURL=explain.d.ts.map