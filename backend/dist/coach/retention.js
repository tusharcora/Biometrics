"use strict";
// Coach data retention and deletion (spec section 5).
//
//   * runCoachRetention(): a daily scheduled job that hard-deletes coach chat
//     transcripts older than 90 days, then any conversation that retention left
//     empty. It does not depend on COACH_ENABLED: turning the coach off must
//     never stop old transcripts from expiring.
//   * deleteUserCoachData(): removes EVERYTHING the coach holds for one user
//     (transcripts, conversations, memory, digests, consent rows, push tokens).
//     Account deletion (src/users/deletion.ts) deletes the same Coach* tables as
//     part of its own single transaction, walking the shared USER_OWNED_MODELS
//     list; this function remains for removing coach data on its own.
//
// Telemetry carries counts only.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCRIPT_RETENTION_DAYS = void 0;
exports.runCoachRetention = runCoachRetention;
exports.deleteUserCoachData = deleteUserCoachData;
const client_1 = require("../db/client");
exports.TRANSCRIPT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Deletes messages STRICTLY older than the retention window: a message exactly
 * `retentionDays` old is kept, one a millisecond older is deleted. Then deletes
 * conversations that are now empty AND stale (their last activity is also past
 * the cutoff), so a conversation being created right now is never touched.
 */
async function runCoachRetention({ now = new Date(), retentionDays = exports.TRANSCRIPT_RETENTION_DAYS, telemetry, } = {}) {
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const messages = await client_1.prisma.coachMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
    const conversations = await client_1.prisma.coachConversation.deleteMany({
        where: { lastMessageAt: { lt: cutoff }, messages: { none: {} } },
    });
    telemetry?.emit({
        name: 'coach.retention_run',
        userId: 'system',
        personaId: 'none',
        attributes: { messagesDeleted: messages.count, conversationsDeleted: conversations.count, retentionDays },
    });
    return { messagesDeleted: messages.count, conversationsDeleted: conversations.count, cutoff };
}
/** Hard-deletes all coach data for a user, atomically. Idempotent: a second call deletes nothing. */
async function deleteUserCoachData(userId, telemetry) {
    const summary = await client_1.prisma.$transaction(async (tx) => {
        // Messages first: they reference both the conversation and the user.
        const messages = await tx.coachMessage.deleteMany({ where: { userId } });
        const conversations = await tx.coachConversation.deleteMany({ where: { userId } });
        const memories = await tx.coachMemory.deleteMany({ where: { userId } });
        const digests = await tx.coachDigest.deleteMany({ where: { userId } });
        const consents = await tx.coachConsent.deleteMany({ where: { userId } });
        const pushTokens = await tx.pushToken.deleteMany({ where: { userId } });
        return {
            messages: messages.count,
            conversations: conversations.count,
            memories: memories.count,
            digests: digests.count,
            consents: consents.count,
            pushTokens: pushTokens.count,
        };
    });
    telemetry?.emit({ name: 'coach.user_data_deleted', userId, personaId: 'none', attributes: { ...summary } });
    return summary;
}
//# sourceMappingURL=retention.js.map