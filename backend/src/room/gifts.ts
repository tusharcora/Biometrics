// Gifts of spare pieces (spec 2026-10-15 §10.3). Only a spare: a placeable piece you own at least twice with at least
// one copy not placed in your stored room; you always keep one of everything. Coins are never gifted, and nothing is
// bought for a gift. The note is picked from a fixed list, never typed. Sending runs under the sender's room lock (the
// one every save takes, §2.2) and re-checks the spare against the stored layout as written, not as the read trims it
// (P4 ruling 11), so a save and a gift can never both use the last spare. 3 a day in the sender's local day; buddies
// only; blocks both ways. The pair row is held FOR SHARE until the gift commits (PF4-F4), so an unpair or a block
// either lands first (the gift is refused) or waits and then returns the gift. A gift is returned to its sender on a
// block or an unpair (returnGiftsTx), never because an account was deleted (the cascade drops gifts to the deleted
// user; gifts from them keep coming, fromId null). No push (ruling 13). Logs the event name only.
import type { Prisma } from '@prisma/client';
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { BuddyError, UUID_RE, isUniqueViolation } from '../buddies/errors';
import { isBlockedEitherWay, orderedPair } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { COIN_TX_OPTIONS } from '../coins/ledger';
import { shippedItem } from '../cosmetics/catalogue';
import { prisma } from '../db/client';
import { isRetryableTx } from '../lib/retryableTx';
import { isUuid } from '../lib/uuid';
import { starterLayout } from './convert';
import { parseLayout, placedCounts } from './geometry';
import { countsOf, grantTotals } from './layout';
import { lockRoom } from './lock';

export const GIFT_NOTES = ['desk', 'cosy', 'thought'] as const;
export type GiftNote = (typeof GIFT_NOTES)[number];
export const GIFTS_PER_DAY = 3;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export interface GiftDTO { id: string; itemId: string; note: GiftNote; from: { name: string } | null; quiet: boolean; at: string }

/** Exactly `{ requestId: <uuid>, itemId, note }` with a known note, or null. */
export function parseGift(body: unknown): { requestId: string; itemId: string; note: GiftNote } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'itemId,note,requestId') return null;
  if (!isUuid(b.requestId) || typeof b.itemId !== 'string' || b.itemId.length > 64) return null;
  if (!(GIFT_NOTES as readonly unknown[]).includes(b.note)) return null;
  return { requestId: b.requestId, itemId: b.itemId, note: b.note as GiftNote };
}

async function countsFor(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<Record<string, number>> {
  const [rows, grants] = await Promise.all([db.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }), grantTotals(db, userId)]);
  return countsOf(rows, grants);
}

/** The pair row, held FOR SHARE to the end of the transaction (PF4-F4): unpair and block DELETE it, so they wait for
 * this gift and then return it, or this read waits for them and finds no pair. */
async function holdPair(tx: Prisma.TransactionClient, a: string, b: string): Promise<boolean> {
  const { userAId, userBId } = orderedPair(a, b);
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "BuddyPair" WHERE "userAId" = ${userAId} AND "userBId" = ${userBId}
    FOR SHARE`;
  return rows.length > 0;
}

export async function sendGift(senderId: string, rawTo: string, body: unknown, now: Date): Promise<{ id: string; counts: Record<string, number> }> {
  if (!UUID_RE.test(rawTo) || rawTo === senderId) throw new BuddyError('not_buddies');
  const parsed = parseGift(body);
  if (!parsed || !shippedItem(parsed.itemId)?.iso) throw new BuddyError('invalid_body');
  const toId = rawTo;
  let sent: boolean;
  try {
    sent = await prisma.$transaction(async (tx) => {
      // The first lock and the first statement: only the sender's room changes here (the recipient's count moves when
      // they open the gift, under their own lock).
      await lockRoom(tx, senderId);
      const before = await tx.gift.findUnique({ where: { id: parsed.requestId }, select: { fromId: true, toId: true, itemId: true } });
      if (before) {
        // A request id names one gift (ruling 11): its retry answers again; reused for another gift it is a bad body.
        if (before.fromId === senderId && before.toId === toId && before.itemId === parsed.itemId) return false;
        throw new BuddyError('invalid_body');
      }
      if (!(await holdPair(tx, senderId, toId)) || (await isBlockedEitherWay(senderId, toId, tx))) throw new BuddyError('not_buddies');
      const me = await tx.user.findUniqueOrThrow({ where: { id: senderId }, select: { timezone: true } });
      const today = localCivilDateOrUtc(now, me.timezone);
      const recent = await tx.gift.findMany({ where: { fromId: senderId, createdAt: { gt: new Date(now.getTime() - TWO_DAYS_MS) } }, select: { createdAt: true } });
      if (recent.filter((g) => localCivilDateOrUtc(g.createdAt, me.timezone) === today).length >= GIFTS_PER_DAY) throw new BuddyError('gift_limit');
      const counts = await countsFor(tx, senderId);
      const row = await tx.cosmeticLoadout.findUnique({ where: { userId: senderId }, select: { layout: true } });
      // The stored layout as written (ruling 11): a copy the read trim hides is still placed here.
      const stored = (row ? parseLayout(row.layout) : null) ?? starterLayout();
      const owned = counts[parsed.itemId] ?? 0;
      const placed = placedCounts(stored)[parsed.itemId] ?? 0;
      if (owned < 2 || owned - placed < 1) throw new BuddyError('not_spare');
      await tx.gift.create({ data: { id: parsed.requestId, fromId: senderId, toId, itemId: parsed.itemId, note: parsed.note, createdAt: now } });
      await tx.itemGrant.create({ data: { userId: senderId, itemId: parsed.itemId, qty: -1, sourceKey: `gift_out:${parsed.requestId}`, seenAt: now } });
      return true;
    }, COIN_TX_OPTIONS);
  } catch (err) {
    // Another sender took this id at the same instant: the id names their gift, so this body is a bad one.
    if (isUniqueViolation(err)) throw new BuddyError('invalid_body');
    if (isRetryableTx(err)) throw new BuddyError('try_later');
    throw err;
  }
  if (sent) console.info(JSON.stringify({ event: 'gift.sent' }));
  return { id: parsed.requestId, counts: await countsFor(prisma, senderId) };
}

/** Unopened gifts to me, oldest first. `quiet`: I muted the sender, so the app shows the box but no line (ruling 13). */
export async function listGifts(userId: string): Promise<{ gifts: GiftDTO[] }> {
  const rows = await prisma.gift.findMany({
    where: { toId: userId, openedAt: null, returnedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fromId: true, itemId: true, note: true, createdAt: true, from: { select: PERSON_SELECT } },
  });
  const senders = [...new Set(rows.flatMap((r) => (r.fromId ? [r.fromId] : [])))];
  const mutes = senders.length ? await prisma.buddyMute.findMany({ where: { muterId: userId, mutedId: { in: senders } }, select: { mutedId: true } }) : [];
  const muted = new Set(mutes.map((m) => m.mutedId));
  return {
    gifts: rows.map((r) => ({
      id: r.id, itemId: r.itemId, note: r.note as GiftNote,
      from: r.from ? { name: toPerson(r.from).displayName } : null,
      quiet: !!r.fromId && muted.has(r.fromId),
      at: r.createdAt.toISOString(),
    })),
  };
}

/** Opens a gift once: the piece joins my inventory as a NEW copy, unseen. An opened gift answers again; a returned
 * one, another person's or an unknown id is gone. */
export async function openGift(userId: string, giftId: string, now: Date): Promise<{ counts: Record<string, number> }> {
  if (!UUID_RE.test(giftId)) throw new BuddyError('gift_gone');
  await prisma.$transaction(async (tx) => {
    await lockRoom(tx, userId);
    const gift = await tx.gift.findUnique({ where: { id: giftId }, select: { toId: true, itemId: true, returnedAt: true } });
    if (!gift || gift.toId !== userId || gift.returnedAt) throw new BuddyError('gift_gone');
    const opened = await tx.gift.updateMany({ where: { id: giftId, openedAt: null, returnedAt: null }, data: { openedAt: now } });
    if (opened.count === 1) {
      await tx.itemGrant.create({ data: { userId, itemId: gift.itemId, qty: 1, sourceKey: `gift_in:${giftId}` } });
      return;
    }
    // A return that landed after the read above won the row: the gift went back to its sender.
    if ((await tx.gift.findUnique({ where: { id: giftId }, select: { returnedAt: true } }))?.returnedAt) throw new BuddyError('gift_gone');
  }, COIN_TX_OPTIONS);
  return { counts: await countsFor(prisma, userId) };
}

/**
 * Inside unpair's or block's transaction (ruling 12): every unopened gift between the two goes back to its sender, each
 * once (the conditional update decides, so an open landing at the same moment wins or loses cleanly). The sender's
 * count only rises, so no room lock is needed. Answers how many went back.
 */
export async function returnGiftsTx(tx: Prisma.TransactionClient, a: string, b: string, now: Date): Promise<number> {
  const open = await tx.gift.findMany({
    where: { openedAt: null, returnedAt: null, OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
    select: { id: true, fromId: true, itemId: true },
  });
  let back = 0;
  for (const g of open) {
    const done = await tx.gift.updateMany({ where: { id: g.id, openedAt: null, returnedAt: null }, data: { returnedAt: now } });
    if (done.count === 1 && g.fromId) {
      await tx.itemGrant.createMany({ data: [{ userId: g.fromId, itemId: g.itemId, qty: 1, sourceKey: `gift_back:${g.id}` }], skipDuplicates: true });
      back++;
    }
  }
  return back;
}
