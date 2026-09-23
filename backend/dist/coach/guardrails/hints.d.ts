import type { TurnToolResult } from './grounding';
export interface ReferenceHint {
    literal: string;
    references: string[];
}
export declare function suggestReferences(raw: string, results: readonly TurnToolResult[]): ReferenceHint[];
/**
 * Replaces each exact copy of a unit-bearing display value from this turn's
 * tool results with its {{reference}}, before validation. Such a phrase is
 * grounded by construction (it IS a value the tools returned this turn), so
 * this only stops the guardrail rejecting a correct answer because the model
 * copied "down 8%" instead of writing {{getMetricHistory.trendDisplay}}. An
 * invented or altered value matches nothing and is still rejected; bare
 * numbers are never matched. Longest values first, so "2h 25m less than the
 * night before" wins over "2h 25m".
 */
export declare function referenceCopiedValues(raw: string, results: readonly TurnToolResult[]): string;
//# sourceMappingURL=hints.d.ts.map