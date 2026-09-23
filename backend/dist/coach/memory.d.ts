export declare const MEMORY_CATEGORIES: readonly ["TRAINING_GOAL", "SCHEDULE", "PREFERENCE"];
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export declare const MAX_MEMORY_VALUE_CHARS = 140;
/** "What I know about you" prompt block cap: the N most recent confirmed entries. */
export declare const MAX_PROMPT_MEMORIES = 10;
/** Bounds stored memory per user (an allowlist should also be a small list). */
export declare const MAX_MEMORY_ENTRIES_PER_USER = 50;
/** A model may not spray proposals in one turn. */
export declare const MAX_PROPOSALS_PER_TURN = 3;
export type MemoryRejection = 'invalid_category' | 'invalid_value' | 'value_too_long' | 'health_content';
export type MemoryValueResult = {
    ok: true;
    value: string;
} | {
    ok: false;
    reason: Exclude<MemoryRejection, 'invalid_category'>;
};
export type MemoryInputResult = {
    ok: true;
    category: MemoryCategory;
    value: string;
} | {
    ok: false;
    reason: MemoryRejection;
};
/** Value-only validation, shared by proposals and by the user's own edits (PATCH). */
export declare function validateMemoryValue(input: unknown): MemoryValueResult;
/** The proposeMemory gate: closed category enum first, then the value checks. */
export declare function validateMemoryInput(input: unknown): MemoryInputResult;
export interface MemoryDTO {
    id: string;
    category: MemoryCategory;
    value: string;
    status: 'PENDING' | 'CONFIRMED';
    createdAt: string;
}
interface MemoryRow {
    id: string;
    category: MemoryCategory;
    value: string;
    status: 'PENDING' | 'CONFIRMED';
    createdAt: Date;
}
export declare const toMemoryDTO: (row: MemoryRow) => MemoryDTO;
export interface MemoryProposal {
    category: MemoryCategory;
    value: string;
}
/**
 * Persists validated proposals as PENDING. Re-validates (defence in depth: the
 * store is the last gate whoever calls it), skips a duplicate of an existing
 * entry, and stops at the per-user cap. Returns only the rows created now.
 */
export declare function createPendingMemories(userId: string, proposals: MemoryProposal[], conversationId?: string | null): Promise<MemoryDTO[]>;
export interface MemoryResolution {
    confirmed: number;
    dismissed: number;
}
/**
 * Applies the user's NEXT message to their PENDING entries, each judged on its
 * own: an entry the message explicitly dismisses or corrects (about that fact)
 * is deleted, every other one becomes CONFIRMED. Every PENDING row at this point
 * was proposed on an earlier turn, because this turn's proposals are only
 * written after the reply is validated. `dismissed` counts rows actually
 * deleted; the orchestrator tells the user when it is above zero.
 */
export declare function resolvePendingMemories(userId: string, message: string, conversationId: string | null): Promise<MemoryResolution>;
/** The newest confirmed entries only, for the "what I know about you" prompt block. */
export declare function loadConfirmedMemories(userId: string, limit?: number): Promise<MemoryProposal[]>;
export {};
//# sourceMappingURL=memory.d.ts.map