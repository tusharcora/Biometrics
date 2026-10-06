// Unpair, block, unblock and mute (spec 2026-10-06 buddies §4). All silent: the other person is told
// nothing and nothing they can see changes shape (a blocked person's request stays "pending" to them).

import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE } from './errors';
import { findPair, lockPairSlot, orderedPair } from './pairs';
import { recipientSees } from './requests';

/** A buddy id from a path: malformed, or one's own, is not_buddies (never a bare 404). */
export function requireBuddyId(raw: string, viewerId: string): string {
  if (!UUID_RE.test(raw) || raw === viewerId) throw new BuddyError('not_buddies');
  return raw;
}

const eitherWay = (a: string, b: string) => ({ OR: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }] });

async function removePairData(tx: Prisma.TransactionClient, a: string, b: string): Promise<void> {
  await tx.buddyPair.deleteMany({ where: orderedPair(a, b) });
  // Mutes go with the pair, both ways: a re-pair starts unmuted.
  await tx.buddyMute.deleteMany({ where: { OR: [{ muterId: a, mutedId: b }, { muterId: b, mutedId: a }] } });
  await tx.sticker.deleteMany({ where: eitherWay(a, b) });
  await tx.buddyActivity.deleteMany({ where: { OR: [{ recipientId: a, actorId: b }, { recipientId: b, actorId: a }] } });
}

/** Either side, silent and idempotent. Requests between the two close: PENDING → CANCELLED, DECLINED withdrawn. */
export async function unpair(userId: string, buddyId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await removePairData(tx, userId, buddyId);
    await tx.buddyRequest.updateMany({ where: { status: 'PENDING', ...eitherWay(userId, buddyId) }, data: { status: 'CANCELLED', respondedAt: now } });
    await tx.buddyRequest.updateMany({ where: { status: 'DECLINED', withdrawnAt: null, ...eitherWay(userId, buddyId) }, data: { withdrawnAt: now } });
  });
}

/**
 * One transaction, under the pair lock (a pairing in flight finishes first and its pair is removed
 * here; one that starts later sees the block): unpair, the blocker's outgoing request cancelled
 * (PENDING → CANCELLED, DECLINED withdrawn), the blocked person's incoming PENDING hidden (it stays
 * "pending" to them), mutes cleared both ways, and the block stored. Idempotent.
 */
export async function block(blockerId: string, blockedId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockPairSlot(tx, blockerId, blockedId);
    await removePairData(tx, blockerId, blockedId);
    await tx.buddyRequest.updateMany({ where: { fromUserId: blockerId, toUserId: blockedId, status: 'PENDING' }, data: { status: 'CANCELLED', respondedAt: now } });
    await tx.buddyRequest.updateMany({ where: { fromUserId: blockerId, toUserId: blockedId, status: 'DECLINED', withdrawnAt: null }, data: { withdrawnAt: now } });
    await tx.buddyRequest.updateMany({ where: { fromUserId: blockedId, toUserId: blockerId, status: 'PENDING' }, data: { hidden: true } });
    await tx.buddyBlock.createMany({ data: [{ blockerId, blockedId, createdAt: now }], skipDuplicates: true });
  });
}

/** Block from an incoming request row: only the recipient of a request they can see. */
export async function blockFromRequest(userId: string, requestId: string, now: Date): Promise<void> {
  const row = UUID_RE.test(requestId) ? await prisma.buddyRequest.findUnique({ where: { id: requestId } }) : null;
  if (!row || row.toUserId !== userId || !recipientSees(row, now)) throw new BuddyError('request_gone');
  await block(userId, row.fromUserId, now);
}

/** Block from a buddy's week: only a buddy. */
export async function blockBuddy(userId: string, buddyId: string, now: Date): Promise<void> {
  if (!(await findPair(userId, buddyId))) throw new BuddyError('not_buddies');
  await block(userId, buddyId, now);
}

/** Lifts the block only: rows already hidden stay hidden. */
export async function unblock(blockerId: string, blockedId: string): Promise<void> {
  await prisma.buddyBlock.deleteMany({ where: { blockerId, blockedId } });
}

export interface BlockedPersonDTO { userId: string; handle: string; displayName: string }

export async function listBlocked(userId: string): Promise<BlockedPersonDTO[]> {
  const rows = await prisma.buddyBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { blocked: { select: { id: true, handle: true, displayName: true } } },
  });
  return rows.map(({ blocked }) => ({ userId: blocked.id, handle: blocked.handle ?? '', displayName: blocked.displayName ?? blocked.handle ?? '' }));
}

/** Muting needs a pair (not_buddies); unmuting never fails. The muted person can't tell. */
export async function setMuted(muterId: string, mutedId: string, muted: boolean): Promise<{ muted: boolean }> {
  if (!muted) {
    await prisma.buddyMute.deleteMany({ where: { muterId, mutedId } });
    return { muted: false };
  }
  if (!(await findPair(muterId, mutedId))) throw new BuddyError('not_buddies');
  await prisma.buddyMute.createMany({ data: [{ muterId, mutedId }], skipDuplicates: true });
  return { muted: true };
}
