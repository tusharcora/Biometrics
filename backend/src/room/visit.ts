// Visiting a buddy's room and cheering it (spec 2026-10-15 §10.1, §10.2). Who: buddies only, neither has blocked the
// other, and only while the owner's "Buddies can visit my room" is on; every other case is the same 404 (P4 ruling 8).
// What: the layout as the owner's own reads show it, the room's size (never its tier, how it was earned, a badge, a
// balance, counts, the living state or anything health-linked; ruling 24), KIP's colour and outfit, and the week's
// cheer count. A cheer pays both people inside one transaction under both room locks (§6.3, ruling 9), from the coins
// launch day on only (the no-backpay gate, T5T7-GATE). Nothing here is logged with an id.
import type { Prisma } from '@prisma/client';
import { civilDateToUtcMidnight, localCivilDateOrUtc, utcMidnightToCivilDate } from '../biometrics/civilDate';
import { COIN_TX_OPTIONS, cheerEarns, lockUsers, logEarned, writeEarnsTx, type CoinEarn, type CoinWritten } from '../coins/ledger';
import { launchDayFor, paysOn } from '../coins/sources';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE, isUniqueViolation } from '../buddies/errors';
import { findPair, isBlockedEitherWay } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { roomOpen } from '../buddies/sharing';
import type { KipWornDTO } from '../cosmetics/worn';
import { shiftDate } from '../scoring/dates';
import { starterLayout } from './convert';
import { tierSize, type RoomLayout, type Tier } from './geometry';
import { countsOf, grantTotals, readLayout, toTier } from './layout';

type Db = Prisma.TransactionClient | typeof prisma;

export interface RoomVisitDTO {
  name: string;
  layout: RoomLayout;
  size: { n: number; m: number };
  kipColour: string;
  kipWorn: KipWornDTO;
  cheersThisWeek: number;
  cheeredToday: boolean;
}

const NOT_FOUND = () => new BuddyError('not_found');

/** A room id from a path: malformed or one's own is the uniform 404 (never not_buddies, which would say why). */
export function visitTarget(raw: string, viewerId: string): string {
  if (!UUID_RE.test(raw) || raw === viewerId) throw NOT_FOUND();
  return raw;
}

/** Buddies, no block either way, and the owner's room open (spec §10.1). */
export async function canVisit(viewerId: string, ownerId: string, db: Db = prisma): Promise<boolean> {
  const [pair, blocked, owner] = await Promise.all([
    findPair(viewerId, ownerId, db),
    isBlockedEitherWay(viewerId, ownerId, db),
    db.user.findUnique({ where: { id: ownerId }, select: { shareRoom: true } }),
  ]);
  return !!pair && !blocked && !!owner && roomOpen(owner);
}

/** The room as its owner's reads show it (P1 ruling 23's trim), or the starter room with no row. */
export async function readOwnedLayout(db: Db, userId: string): Promise<{ layout: RoomLayout; tier: Tier }> {
  const [rows, grants, row] = await Promise.all([
    db.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
    grantTotals(db, userId),
    db.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, tier: true } }),
  ]);
  const layout = (row ? readLayout(row.layout, countsOf(rows, grants)) : null) ?? starterLayout();
  return { layout, tier: toTier(row?.tier) };
}

/** The Monday and the Sunday of a civil date's ISO week. */
export function weekDays(today: string): [string, string] {
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  const monday = shiftDate(today, -weekday);
  return [monday, shiftDate(monday, 6)];
}

async function cheersInWeek(db: Db, ownerId: string, ownerTz: string, now: Date): Promise<number> {
  const [from, to] = weekDays(localCivilDateOrUtc(now, ownerTz));
  return db.roomCheer.count({ where: { toId: ownerId, localDate: { gte: civilDateToUtcMidnight(from), lte: civilDateToUtcMidnight(to) } } });
}

export async function readVisit(viewerId: string, ownerId: string, now: Date): Promise<RoomVisitDTO> {
  if (!(await canVisit(viewerId, ownerId))) throw NOT_FOUND();
  const [owner, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { ...PERSON_SELECT, timezone: true } }),
    prisma.user.findUnique({ where: { id: viewerId }, select: { timezone: true } }),
  ]);
  if (!owner || !viewer) throw NOT_FOUND();
  const person = toPerson(owner);
  const { layout, tier } = await readOwnedLayout(prisma, ownerId);
  const today = localCivilDateOrUtc(now, viewer.timezone);
  const [cheersThisWeek, mine] = await Promise.all([
    cheersInWeek(prisma, ownerId, owner.timezone, now),
    prisma.roomCheer.findUnique({ where: { fromId_toId_localDate: { fromId: viewerId, toId: ownerId, localDate: civilDateToUtcMidnight(today) } }, select: { id: true } }),
  ]);
  // Built key by key: the size, never the tier it comes from.
  return { name: person.displayName, layout, size: tierSize(tier), kipColour: person.kipColour, kipWorn: person.kipWorn, cheersThisWeek, cheeredToday: !!mine };
}

/** A transaction that lost a lock wait (P2028: Prisma's interactive-transaction timeout) or a deadlock (Postgres
 * 40P01; Prisma's P2034 for a write conflict or deadlock, or a raw statement's P2010 carrying it): nothing was written,
 * and the same request can be sent again. */
export function isRetryableTx(err: unknown): boolean {
  const e = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
  if (!e) return false;
  if (e.code === 'P2028' || e.code === 'P2034' || e.code === '40P01' || e.meta?.code === '40P01') return true;
  return typeof e.message === 'string' && /\b40P01\b|deadlock detected/.test(e.message);
}

/** One cheer per room per visitor's day, paying both people from their own launch day on (spec §10.2, ruling 9). */
export async function cheerRoom(viewerId: string, ownerId: string, now: Date): Promise<{ paid: boolean }> {
  let written: CoinWritten[] = [];
  let paid = false;
  try {
    await prisma.$transaction(async (tx) => {
      // The first lock and the first statement (lockUsers' contract, T3-FIX): both rooms, in one global order.
      await lockUsers(tx, [viewerId, ownerId]);
      if (!(await canVisit(viewerId, ownerId, tx))) throw NOT_FOUND();
      const zones = await tx.user.findMany({ where: { id: { in: [viewerId, ownerId] } }, select: { id: true, timezone: true } });
      const tzOf = (id: string) => zones.find((z) => z.id === id)?.timezone ?? 'UTC';
      const giverDay = localCivilDateOrUtc(now, tzOf(viewerId));
      const ownerDay = localCivilDateOrUtc(now, tzOf(ownerId));
      // A second cheer on the giver's day is the unique key (P2002), which ends the transaction: nothing is written.
      const row = await tx.roomCheer.create({ data: { fromId: viewerId, toId: ownerId, localDate: civilDateToUtcMidnight(giverDay), createdAt: now }, select: { id: true } });
      const key = `cheer:${row.id}`;
      // The no-backpay gate (T5T7-GATE): each side pays only on or after its own local launch day.
      const side = (userId: string, day: string, s: 'given' | 'got'): CoinEarn[] =>
        (paysOn(day, launchDayFor(tzOf(userId))) ? [cheerEarns(key, day, s)] : []);
      const given = await writeEarnsTx(tx, viewerId, side(viewerId, giverDay, 'given'), now);
      const got = await writeEarnsTx(tx, ownerId, side(ownerId, ownerDay, 'got'), now);
      written = [...given, ...got];
      paid = given.some((w) => w.amount > 0);
    }, COIN_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) throw new BuddyError('already_cheered');
    if (isRetryableTx(err)) {
      console.warn(JSON.stringify({ event: 'room.cheer_failed', error: err instanceof Error ? err.name : 'Error' }));
      throw new BuddyError('try_later');
    }
    throw err;
  }
  logEarned(written);
  return { paid };
}

/** This week's cheers on my room, with the cheering buddies' names (spec §10.2: the owner sees who cheered). Anyone
 * I blocked or who blocked me is left out, name and count (PF4-F18). */
export async function listRoomCheers(userId: string, now: Date): Promise<{ count: number; cheers: Array<{ name: string; day: string }> }> {
  const [me, blocks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    prisma.buddyBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } }),
  ]);
  const hidden = blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  const [from, to] = weekDays(localCivilDateOrUtc(now, me?.timezone ?? 'UTC'));
  const rows = await prisma.roomCheer.findMany({
    where: { toId: userId, fromId: { notIn: hidden }, localDate: { gte: civilDateToUtcMidnight(from), lte: civilDateToUtcMidnight(to) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { localDate: true, from: { select: { displayName: true, handle: true } } },
  });
  return { count: rows.length, cheers: rows.map((r) => ({ name: r.from.displayName ?? r.from.handle ?? '', day: utcMidnightToCivilDate(r.localDate) })) };
}
