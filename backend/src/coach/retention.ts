// Coach data retention and deletion (spec section 5).
//
//   * runCoachRetention(): a daily scheduled job that hard-deletes coach chat
//     transcripts older than 90 days, then any conversation that retention left
//     empty. It does not depend on COACH_ENABLED: turning the coach off must
//     never stop old transcripts from expiring.
//   * deleteUserCoachData(): removes EVERYTHING the coach holds for one user
//     (transcripts, conversations, memory, digests, consent rows, push tokens).
//     It is exported for the future account-deletion flow. Account deletion
//     itself is not built here; the spec calls that out as its own piece of work.
//
// Telemetry carries counts only.

import { prisma } from '../db/client';
import type { CoachTelemetry } from './telemetry';

export const TRANSCRIPT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionSummary {
  messagesDeleted: number;
  conversationsDeleted: number;
  cutoff: Date;
}

/**
 * Deletes messages STRICTLY older than the retention window: a message exactly
 * `retentionDays` old is kept, one a millisecond older is deleted. Then deletes
 * conversations that are now empty AND stale (their last activity is also past
 * the cutoff), so a conversation being created right now is never touched.
 */
export async function runCoachRetention({
  now = new Date(),
  retentionDays = TRANSCRIPT_RETENTION_DAYS,
  telemetry,
}: { now?: Date; retentionDays?: number; telemetry?: CoachTelemetry } = {}): Promise<RetentionSummary> {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const messages = await prisma.coachMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const conversations = await prisma.coachConversation.deleteMany({
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

export interface UserDataDeletionSummary {
  messages: number;
  conversations: number;
  memories: number;
  digests: number;
  consents: number;
  pushTokens: number;
}

/** Hard-deletes all coach data for a user, atomically. Idempotent: a second call deletes nothing. */
export async function deleteUserCoachData(userId: string, telemetry?: CoachTelemetry): Promise<UserDataDeletionSummary> {
  const summary = await prisma.$transaction(async (tx) => {
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
