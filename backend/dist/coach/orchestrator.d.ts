import { CoachClock } from './clock';
import { GuardrailReason } from './guardrails/grounding';
import { MemoryDTO } from './memory';
import type { CoachModelProvider, CoachTier } from './model/provider';
import type { CoachTelemetry } from './telemetry';
import { CoachTools } from './tools';
export declare const FAST_TIER_BUDGET_MS = 12000;
/**
 * The spec gives the synthesis tier no user-facing budget because its main use
 * (the weekly recap) is a background job. Inline, an unbounded wait would hang
 * the request, so it gets a generous safety cap instead.
 */
export declare const SYNTHESIS_TIER_BUDGET_MS = 60000;
export declare const MAX_MODEL_CALLS = 8;
export declare const HISTORY_WINDOW = 10;
/** Fixed, server-appended (never model-generated) when a memory proposal was stored this turn. No digits. */
export declare const MEMORY_NOTE = "I'll remember that \u2014 let me know if that's not right.";
/** Fixed, server-appended (never model-generated) when the user's message deleted a pending memory. No digits. */
export declare const MEMORY_REMOVED_NOTE = "Okay \u2014 I've removed that from what I remember.";
export interface CoachTurnInput {
    userId: string;
    message: string;
    /** Prior turns of this conversation, oldest first. Assistant text may still carry the disclaimer. */
    history: Array<{
        role: 'user' | 'assistant';
        text: string;
    }>;
    safetyOverride?: boolean;
    /**
     * The conversation this message belongs to, or null when it starts a new one.
     * Memory proposals are settled only by the next message in the SAME
     * conversation, so a new conversation settles nothing.
     */
    conversationId?: string | null;
}
/** Persisted on the assistant message: reasons and counts only. */
export type CoachTurnEvent = {
    type: 'guardrail_reject';
    reason: GuardrailReason;
    attempt: number;
    outcome: 'regenerate' | 'fallback';
} | {
    type: 'latency_budget_exceeded';
};
export interface CoachTurnResult {
    /** Final reply text, disclaimer included. */
    text: string;
    source: 'MODEL' | 'FALLBACK' | 'SAFETY';
    events: CoachTurnEvent[];
    safety?: {
        resources: string[];
        canContinue: true;
    };
    tier: CoachTier;
    personaId: string;
    /** Memory entries written (PENDING) this turn, only when the reply itself was a validated model reply. */
    memoryProposals?: MemoryDTO[];
}
export interface OrchestratorDeps {
    provider: CoachModelProvider;
    telemetry: CoachTelemetry;
    tools?: CoachTools;
    clock?: CoachClock;
    budgets?: {
        fast?: number;
        synthesis?: number;
    };
    loadUser?: (userId: string) => Promise<{
        timezone: string;
        coachPersonaId: string | null;
    }>;
}
export declare function createCoachOrchestrator(deps: OrchestratorDeps): {
    handleTurn: (input: CoachTurnInput) => Promise<CoachTurnResult>;
};
//# sourceMappingURL=orchestrator.d.ts.map