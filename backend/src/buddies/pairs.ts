// Pairs (spec 2026-10-06 buddies §3-§4). A pair is stored once, userAId < userBId. createPair is the
// only writer: from a redeemed code, an accepted request, or crossed requests. A unique-constraint
// error (P2002) on the pair means it already exists: success, not an error.

import type { BuddyPair, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { BuddyError, isUniqueViolation } from './errors';
import { pushName } from './notify';
import { enqueueBuddyNotice, type NotifyQueue } from './notifyQueue';

type Db = Prisma.TransactionClient | typeof prisma;

export interface PairDeps {
  /** Default: the shared buddy notify queue (getBuddyNotifyQueue). */
  notifyQueue?: NotifyQueue;
}

/** Ids are lowercase UUIDs (Prisma uuid()), so JS string order and the DB collation agree on which is userA. */
export function orderedPair(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export function findPair(a: string, b: string, db: Db = prisma): Promise<BuddyPair | null> {
  return db.buddyPair.findUnique({ where: { userAId_userBId: orderedPair(a, b) } });
}

export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  return (await prisma.buddyBlock.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } })) !== null;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  return (await prisma.buddyBlock.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
}

export interface PairingUser {
  id: string;
  handle: string;
  displayName: string | null;
}

/** Every pairing action needs a handle (handle_required) and the mood notice (mood_notice_required). */
export async function requirePairingReady(userId: string): Promise<PairingUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, handle: true, displayName: true, buddyMoodNoticeAt: true } });
  if (!user?.handle) throw new BuddyError('handle_required');
  if (!user.buddyMoodNoticeAt) throw new BuddyError('mood_notice_required');
  return { id: user.id, handle: user.handle, displayName: user.displayName };
}

export async function createPair(a: string, b: string, now: Date, deps: PairDeps = {}): Promise<{ pairId: string; created: boolean }> {
  let pairId: string;
  try {
    pairId = await prisma.$transaction(async (tx) => {
      const pair = await tx.buddyPair.create({ data: { ...orderedPair(a, b), createdAt: now, lastActivityAt: now } });
      // Any request still pending between the two (either way, hidden or not) is answered by the pairing.
      await tx.buddyRequest.updateMany({
        where: { status: 'PENDING', OR: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }] },
        data: { status: 'ACCEPTED', respondedAt: now },
      });
      await tx.buddyActivity.createMany({
        data: [
          { recipientId: a, actorId: b, kind: 'PAIRED', refId: pair.id, createdAt: now },
          { recipientId: b, actorId: a, kind: 'PAIRED', refId: pair.id, createdAt: now },
        ],
        skipDuplicates: true,
      });
      return pair.id;
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await findPair(a, b);
    if (!existing) throw err;
    return { pairId: existing.id, created: false };
  }
  // Enqueued, never sent here: the job decides mute and quiet hours (Global Constraints).
  const people = await prisma.user.findMany({ where: { id: { in: [a, b] } }, select: { id: true, displayName: true, handle: true } });
  for (const recipient of people) {
    const other = people.find((p) => p.id !== recipient.id);
    if (!other) continue;
    await enqueueBuddyNotice(
      { kind: 'buddy_paired', recipientId: recipient.id, actorId: other.id, refId: other.id, slots: { name: pushName(other) } },
      deps.notifyQueue ? { queue: deps.notifyQueue } : {},
    );
  }
  return { pairId, created: true };
}
