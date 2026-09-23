"use strict";
// Coach memory (spec sections 5 and 6). An ALLOWLIST, not a free-text store:
//
//   * The only way a row is created is a proposal that passes
//     validateMemoryInput(): a category from the closed enum, a value of at most
//     140 characters, and a value the health-fact classifier does not block.
//     Anything that fits no category simply has nowhere to go, so a health fact
//     stated in chat is never persisted however it is phrased.
//   * A new row is PENDING. It becomes CONFIRMED when the user's NEXT message
//     does not correct or dismiss THAT entry (guardrails/memoryFeedback.ts), and
//     is deleted when it does (the reply then says so). Users can edit or delete any row at any time.
//   * Only CONFIRMED rows are surfaced into a prompt, capped at the newest
//     MAX_PROMPT_MEMORIES.
//
// Nothing here logs a value. Callers emit ids and counts only.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMemoryDTO = exports.MAX_PROPOSALS_PER_TURN = exports.MAX_MEMORY_ENTRIES_PER_USER = exports.MAX_PROMPT_MEMORIES = exports.MAX_MEMORY_VALUE_CHARS = exports.MEMORY_CATEGORIES = void 0;
exports.validateMemoryValue = validateMemoryValue;
exports.validateMemoryInput = validateMemoryInput;
exports.createPendingMemories = createPendingMemories;
exports.resolvePendingMemories = resolvePendingMemories;
exports.loadConfirmedMemories = loadConfirmedMemories;
const client_1 = require("../db/client");
const healthFact_1 = require("./guardrails/healthFact");
const memoryFeedback_1 = require("./guardrails/memoryFeedback");
exports.MEMORY_CATEGORIES = ['TRAINING_GOAL', 'SCHEDULE', 'PREFERENCE'];
exports.MAX_MEMORY_VALUE_CHARS = 140;
/** "What I know about you" prompt block cap: the N most recent confirmed entries. */
exports.MAX_PROMPT_MEMORIES = 10;
/** Bounds stored memory per user (an allowlist should also be a small list). */
exports.MAX_MEMORY_ENTRIES_PER_USER = 50;
/** A model may not spray proposals in one turn. */
exports.MAX_PROPOSALS_PER_TURN = 3;
const isCategory = (v) => typeof v === 'string' && exports.MEMORY_CATEGORIES.includes(v);
/** Control characters and runs of whitespace collapse to single spaces; the ends are trimmed. */
function normalizeValue(value) {
    return value.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
}
/** Value-only validation, shared by proposals and by the user's own edits (PATCH). */
function validateMemoryValue(input) {
    if (typeof input !== 'string')
        return { ok: false, reason: 'invalid_value' };
    const value = normalizeValue(input);
    if (value.length === 0)
        return { ok: false, reason: 'invalid_value' };
    if (value.length > exports.MAX_MEMORY_VALUE_CHARS)
        return { ok: false, reason: 'value_too_long' };
    if ((0, healthFact_1.classifyHealthFact)(value).blocked)
        return { ok: false, reason: 'health_content' };
    return { ok: true, value };
}
/** The proposeMemory gate: closed category enum first, then the value checks. */
function validateMemoryInput(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input))
        return { ok: false, reason: 'invalid_category' };
    const { category, value } = input;
    if (!isCategory(category))
        return { ok: false, reason: 'invalid_category' };
    const checked = validateMemoryValue(value);
    return checked.ok ? { ok: true, category, value: checked.value } : checked;
}
const toMemoryDTO = (row) => ({
    id: row.id,
    category: row.category,
    value: row.value,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
});
exports.toMemoryDTO = toMemoryDTO;
/**
 * Persists validated proposals as PENDING. Re-validates (defence in depth: the
 * store is the last gate whoever calls it), skips a duplicate of an existing
 * entry, and stops at the per-user cap. Returns only the rows created now.
 */
async function createPendingMemories(userId, proposals, conversationId = null) {
    const created = [];
    if (proposals.length === 0)
        return created;
    const existing = await client_1.prisma.coachMemory.findMany({ where: { userId }, select: { category: true, value: true } });
    const seen = new Set(existing.map((e) => `${e.category}|${e.value.toLowerCase()}`));
    let total = existing.length;
    for (const proposal of proposals) {
        const checked = validateMemoryInput(proposal);
        if (!checked.ok)
            continue;
        const key = `${checked.category}|${checked.value.toLowerCase()}`;
        if (seen.has(key) || total >= exports.MAX_MEMORY_ENTRIES_PER_USER)
            continue;
        let row;
        try {
            row = await client_1.prisma.coachMemory.create({
                data: { userId, category: checked.category, value: checked.value, status: 'PENDING', conversationId },
            });
        }
        catch (err) {
            // The (userId, category, value) unique index: another turn proposed the
            // same fact between the read above and this write. Nothing to add.
            if (err?.code === 'P2002')
                continue;
            throw err;
        }
        seen.add(key);
        total++;
        created.push((0, exports.toMemoryDTO)(row));
    }
    return created;
}
/**
 * Applies the user's NEXT message to their PENDING entries, each judged on its
 * own: an entry the message explicitly dismisses or corrects (about that fact)
 * is deleted, every other one becomes CONFIRMED. Every PENDING row at this point
 * was proposed on an earlier turn, because this turn's proposals are only
 * written after the reply is validated. `dismissed` counts rows actually
 * deleted; the orchestrator tells the user when it is above zero.
 */
async function resolvePendingMemories(userId, message, conversationId) {
    // A proposal belongs to the conversation it was made in. Resolving across all
    // of a user's conversations meant a message in one settled -- confirmed or
    // silently deleted -- proposals the user had never been shown in that thread.
    // A brand-new conversation has nothing of its own pending yet, so it settles
    // nothing.
    if (conversationId === null)
        return { confirmed: 0, dismissed: 0 };
    const pending = await client_1.prisma.coachMemory.findMany({
        where: { userId, status: 'PENDING', conversationId },
        select: { id: true, value: true },
    });
    if (pending.length === 0)
        return { confirmed: 0, dismissed: 0 };
    const dismissIds = [];
    const confirmIds = [];
    for (const p of pending)
        ((0, memoryFeedback_1.classifyMemoryFeedback)(message, p.value) === 'dismiss' ? dismissIds : confirmIds).push(p.id);
    let confirmed = 0;
    let dismissed = 0;
    if (confirmIds.length > 0) {
        const r = await client_1.prisma.coachMemory.updateMany({
            where: { id: { in: confirmIds }, status: 'PENDING' },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
        confirmed = r.count;
    }
    if (dismissIds.length > 0) {
        const r = await client_1.prisma.coachMemory.deleteMany({ where: { id: { in: dismissIds }, status: 'PENDING' } });
        dismissed = r.count;
    }
    return { confirmed, dismissed };
}
/** The newest confirmed entries only, for the "what I know about you" prompt block. */
async function loadConfirmedMemories(userId, limit = exports.MAX_PROMPT_MEMORIES) {
    const rows = await client_1.prisma.coachMemory.findMany({
        where: { userId, status: 'CONFIRMED' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: { category: true, value: true },
    });
    return rows.map((r) => ({ category: r.category, value: r.value }));
}
//# sourceMappingURL=memory.js.map