// The social tables (Buddies spec §3, Social tab S1, S2 and S3, free-build P4). None has a `userId`, so the
// USER_OWNED_MODELS guard (tests/users/deletion.test.ts) does not see them; they rely on
// database cascades instead, and tests/buddies/deletion.test.ts introspects the schema against
// this list so a future social table must be added here (and to that test's seed).
// RoomCheer and ChallengeCheer stay out of USER_OWNED_MODELS on purpose: both of their User
// foreign keys cascade, so either person's deletion removes the row. Gift's sender sets null
// (a deleted gifter's gift is still delivered) and its recipient cascades.

import type { PrismaClient } from '@prisma/client';

export const SOCIAL_MODELS = [
  'BuddyPair',
  'BuddyRequest',
  'BuddyCode',
  'BuddyBlock',
  'BuddyMute',
  'Sticker',
  'BuddyActivity',
  'HandleHold',
  'CheckIn',
  'StorySeen',
  'RecapShare',
  'StepGoalEvent',
  'WeeklyHighlights',
  'Goodnight',
  'CampNote',
  'Conversation',
  'Message',
  'MessageReaction',
  'ConversationRead',
  'StatusNote',
  'Report',
  'RoomCheer',
  'Gift',
  'ChallengeCheer',
] as const;

export type SocialModel = (typeof SOCIAL_MODELS)[number];

/** Every column of a social model that holds a User id, by role. */
export const SOCIAL_USER_COLUMNS: Readonly<Record<SocialModel, readonly string[]>> = {
  BuddyPair: ['userAId', 'userBId'],
  BuddyRequest: ['fromUserId', 'toUserId'],
  BuddyCode: ['ownerId', 'usedById'],
  BuddyBlock: ['blockerId', 'blockedId'],
  BuddyMute: ['muterId', 'mutedId'],
  Sticker: ['fromUserId', 'toUserId'],
  BuddyActivity: ['recipientId', 'actorId'],
  HandleHold: ['previousOwnerId'],
  CheckIn: ['authorId'],
  StorySeen: ['viewerId', 'authorId'],
  RecapShare: ['sharerId'],
  StepGoalEvent: ['authorId'],
  WeeklyHighlights: ['viewerId'],
  Goodnight: ['authorId'],
  CampNote: ['authorId'],
  Conversation: ['userAId', 'userBId'],
  Message: ['senderId'],
  MessageReaction: ['reactorId'],
  ConversationRead: ['readerId'],
  StatusNote: ['authorId'],
  Report: ['reporterId', 'reportedUserId'],
  RoomCheer: ['fromId', 'toId'],
  Gift: ['fromId', 'toId'],
  ChallengeCheer: ['fromId', 'toId'],
};

/** `Model.column` pairs whose foreign key sets null instead of cascading. */
export const SET_NULL_COLUMNS: ReadonlySet<string> = new Set(['BuddyCode.usedById', 'HandleHold.previousOwnerId', 'Gift.fromId']);

/**
 * Some rows name people by id inside JSON, which no foreign key can cascade. On account deletion:
 * - every week-highlight cache (WeeklyHighlights.items) naming the user is deleted; the next read rebuilds it from
 *   rows that no longer include them. Reads also gate every cached actor against the live circle, so a deleted id
 *   never surfaces even if this purge fails.
 * - the user's id is dropped from every challenge entry's circle (ChallengeEntry.circle, P4 ruling 6), so a closed
 *   week's judging no longer counts them.
 * Returns the number of rows deleted or rewritten.
 */
export async function purgeSocialJsonMentions(db: Pick<PrismaClient, '$executeRaw'>, userId: string): Promise<number> {
  const caches = await db.$executeRaw`DELETE FROM "WeeklyHighlights" WHERE "items" @> ${JSON.stringify([{ actorId: userId }])}::jsonb`;
  // jsonb minus text removes every array element equal to that string.
  const circles = await db.$executeRaw`
    UPDATE "ChallengeEntry" SET "circle" = "circle" - ${userId}::text WHERE "circle" @> ${JSON.stringify([userId])}::jsonb`;
  return caches + circles;
}
