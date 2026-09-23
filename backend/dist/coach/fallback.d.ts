import type { CoachTools, DailyScoreToolResult } from './tools';
export interface Preamble {
    /** Today's getDailyScore result (may hold nulls before today's score exists); null when the pre-fetch failed. */
    today: DailyScoreToolResult | null;
    /** The score the fallback is composed from: today's, else the most recent one; null means "static message". */
    fallbackScore: DailyScoreToolResult | null;
}
export declare function loadPreamble(tools: CoachTools, userId: string, today: string): Promise<Preamble>;
/** Fixed; no numbers. Used when there is no score to compose from (spec's exact wording). */
export declare const STATIC_FALLBACK = "I can't reach your data right now \u2014 please try again in a moment.";
export declare function dateLabel(civilDate: string): string;
/**
 * Builds the fallback body (without the disclaimer, which the orchestrator
 * adds to every reply) from the preamble alone: no model involved.
 */
export declare function composeFallback(preamble: Preamble, todayDate: string): string;
//# sourceMappingURL=fallback.d.ts.map