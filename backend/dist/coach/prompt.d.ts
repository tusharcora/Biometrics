import { MemoryProposal } from './memory';
import { CoachPersona } from './personas';
/**
 * Renders a config value as a single quoted data string: control characters and
 * newlines collapse to spaces, template/markup metacharacters are dropped
 * (braces can never form a `{{ref}}`), the length is capped, and JSON quoting
 * escapes any remaining quote or backslash.
 */
export declare function escapeField(value: unknown, max?: number): string;
export interface PromptContext {
    /** The user's local civil date, YYYY-MM-DD. A date, not health data. */
    today: string;
    /** CONFIRMED coach memory, newest first. Only the first MAX_PROMPT_MEMORIES are ever rendered. */
    memories?: MemoryProposal[];
}
/**
 * The "what I know about you" block. Confirmed entries only (the caller loads
 * nothing else), capped at the newest N, and every value goes through
 * escapeField exactly like a persona field: never concatenated raw, so a stored
 * value cannot carry markup or a {{reference}} into the prompt. The category
 * comes from the closed enum, mapped to a fixed label.
 */
export declare function buildMemoryBlock(memories: readonly MemoryProposal[] | undefined): string[];
export declare function buildSystemPrompt(persona: CoachPersona, ctx: PromptContext): string;
/** The names the digest job registers its pre-fetched results under; also what the model may reference. */
export declare const DIGEST_RESULT_NAMES: {
    readonly recovery: "recoveryHistory";
    readonly sleep: "sleepHistory";
    readonly correlations: "getHabitCorrelations";
};
/**
 * System prompt for the weekly recap (synthesis tier, background job). Same
 * fixed-template rule as the chat prompt: persona fields only via escapeField.
 * The recap's source data is pre-fetched by the server and named below; the
 * same whole-reply grounding guardrail validates what comes back.
 */
export declare function buildDigestSystemPrompt(persona: CoachPersona, ctx: PromptContext): string;
/** Sent as an extra system message when the previous attempt at this turn was rejected. */
export declare function buildCorrectiveMessage(reasons: readonly string[], hints?: readonly {
    literal: string;
    references: string[];
}[]): string;
//# sourceMappingURL=prompt.d.ts.map