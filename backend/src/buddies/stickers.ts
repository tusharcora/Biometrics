// Stickers (spec 2026-10-06 buddies §4): only between buddies, at most 5 per buddy per day counted
// in the database in the SENDER's local day (a concurrent race may let a sixth through; accepted).
// The limit is checked before the pair: it counts only the sender's own sends, so it reveals
// nothing about the other person. The pair update, the sticker insert and the STICKER Activity row
// share a transaction: a sticker sent while the pair is being removed is dropped (not_buddies).

import type { StickerKind } from '@prisma/client';
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { BuddyError } from './errors';
import { pushName } from './notify';
import { enqueueBuddyNotice } from './notifyQueue';
import { orderedPair, type PairDeps } from './pairs';

export const STICKER_KINDS: readonly StickerKind[] = ['CHEER', 'HEART', 'REST_UP', 'STAR'];
export const STICKERS_PER_BUDDY_PER_DAY = 5;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export async function sendSticker(fromId: string, toId: string, kind: unknown, now: Date, deps: PairDeps = {}): Promise<{ id: string }> {
  if (!(STICKER_KINDS as readonly unknown[]).includes(kind)) throw new BuddyError('invalid_sticker');
  const me = await prisma.user.findUnique({ where: { id: fromId }, select: { timezone: true, displayName: true, handle: true } });
  if (!me) throw new BuddyError('not_buddies');
  const today = localCivilDateOrUtc(now, me.timezone);
  const recent = await prisma.sticker.findMany({
    where: { fromUserId: fromId, toUserId: toId, sentAt: { gt: new Date(now.getTime() - TWO_DAYS_MS) } },
    select: { sentAt: true },
  });
  if (recent.filter((s) => localCivilDateOrUtc(s.sentAt, me.timezone) === today).length >= STICKERS_PER_BUDDY_PER_DAY) {
    throw new BuddyError('sticker_limit');
  }
  const id = await prisma.$transaction(async (tx) => {
    const bumped = await tx.buddyPair.updateMany({ where: orderedPair(fromId, toId), data: { lastActivityAt: now } });
    if (bumped.count === 0) throw new BuddyError('not_buddies');
    const sticker = await tx.sticker.create({ data: { fromUserId: fromId, toUserId: toId, kind: kind as StickerKind, sentAt: now }, select: { id: true } });
    await tx.buddyActivity.create({ data: { recipientId: toId, actorId: fromId, kind: 'STICKER', refId: sticker.id, createdAt: now } });
    return sticker.id;
  });
  // Enqueued whether or not the buddy muted or blocked me: the job decides (Global Constraints).
  await enqueueBuddyNotice(
    { kind: 'buddy_sticker', recipientId: toId, actorId: fromId, refId: fromId, slots: { name: pushName(me), sticker: kind as StickerKind } },
    deps.notifyQueue ? { queue: deps.notifyQueue } : {},
  );
  return { id };
}
