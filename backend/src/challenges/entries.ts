// Entering the weekly theme challenge (spec 2026-10-15 §10.4). Entering is the opt-in for the entry's snapshot (a
// controller ruling): buddies who open the challenge see it whether or not the room is open to visits. The entry is
// the room: every save while the entry is open copies the saved layout in (snapshotOnSaveTx, inside the save's
// transaction), and the +30 pays once, the first time the entry meets the brief while open (ruling 7), from the coins
// launch day on only (T5T7-GATE). Entry cheers follow the room-cheer coin rules, keyed per week, entrant and cheerer
// (ruling 10). The snapshot is { layout, size } only: never the tier, the living room or anything health-linked. Logs
// event names and error names only.
import type { Prisma } from '@prisma/client';
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { EARN_AMOUNTS } from '../coins/amounts';
import { COIN_TX_OPTIONS, applyCoinEvents, cheerEarns, lockUsers, logEarned, writeEarnsTx, type CoinEarn, type CoinWritten } from '../coins/ledger';
import { launchDayFor, paysOn } from '../coins/sources';
import type { ChallengeTag } from '../cosmetics/catalogue';
import type { KipWornDTO } from '../cosmetics/worn';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE, isForeignKeyViolation, isUniqueViolation } from '../buddies/errors';
import { blockedEitherWay, findPair, isBlockedEitherWay } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { isRetryableTx } from '../lib/retryableTx';
import { tierSize, type RoomLayout, type Tier } from '../room/geometry';
import { lockRoom } from '../room/lock';
import { readOwnedLayout } from '../room/visit';
import { buddyIdsOf } from '../social/circle';
import { readResults, settleChallengesSafely, type ResultsDTO } from './judge';
import { briefCount, meetsBrief, themeFor, type Theme, type ThemeId } from './themes';
import { closesAt, previousWeek, resultsAt, weekOf } from './week';

export interface Snapshot { layout: RoomLayout; size: { n: number; m: number } }
export interface EntryDTO { userId: string; name: string; kipColour: string; kipWorn: KipWornDTO; snapshot: Snapshot; cheers: number; cheeredByMe: boolean; mine: boolean }
export interface ChallengeDTO {
  week: string;
  theme: { id: ThemeId; tag: ChallengeTag; atLeast: number; themePiece: string; trophy: string } | null;
  closesAt: string | null;
  open: boolean;
  entry: { count: number; meets: boolean; paid: boolean } | null;
  entries: EntryDTO[];
  results: ResultsDTO | null;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Built key by key: the size, never the tier it comes from. */
const snapshotOf = (layout: RoomLayout, tier: Tier): Snapshot => ({ layout, size: tierSize(tier) });
const tzOf = async (db: Db, userId: string) =>
  (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone ?? 'UTC';
const NOT_FOUND = () => new BuddyError('not_found');

/** A stored circle (JSON) holds exactly these ids, in any order. */
function sameIds(json: unknown, ids: readonly string[]): boolean {
  if (!Array.isArray(json) || json.length !== ids.length) return false;
  const want = new Set(ids);
  return json.every((v) => typeof v === 'string' && want.has(v));
}

/** Pays the entry's +30 once if the layout meets the brief and the entrant's coins have launched (no backpay,
 * T5T7-GATE), then marks the entry paid. Never throws: the next save or entry read tries again (the key makes it
 * idempotent). */
export async function payEntryIfMet(userId: string, weekId: string, layout: RoomLayout, theme: Theme, now: Date): Promise<void> {
  if (!meetsBrief(layout, theme)) return;
  try {
    const tz = await tzOf(prisma, userId);
    if (!paysOn(localCivilDateOrUtc(now, tz), launchDayFor(tz))) return;
    await applyCoinEvents(userId, [{ kind: 'challenge', sourceKey: `challenge:${weekId}`, amount: EARN_AMOUNTS.challenge, capDay: null }], now);
    await prisma.challengeEntry.updateMany({ where: { userId, weekId, paidAt: null }, data: { paidAt: now } });
  } catch (err) {
    console.warn(JSON.stringify({ event: 'coins.earn_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}

/** Inside PUT /me/cosmetics' transaction, which holds the room lock: an open entry this week takes the saved layout and
 * the current circle. Answers what the caller pays after the commit, or null (no open entry, or its +30 already paid:
 * no second locked coin transaction, FINAL-M4). Every read goes through `tx` (ruling T7-FIX): a global-client read here
 * would hold a second pool connection while the save holds its own. */
export async function snapshotOnSaveTx(tx: Prisma.TransactionClient, userId: string, layout: RoomLayout, tier: Tier, now: Date): Promise<{ weekId: string; theme: Theme } | null> {
  const tz = await tzOf(tx, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  if (!theme || now >= closesAt(weekId, tz)) return null;
  const entry = await tx.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId } }, select: { paidAt: true } });
  if (!entry) return null;
  const circle = await buddyIdsOf(userId, tx);
  const done = await tx.challengeEntry.updateMany({
    where: { userId, weekId },
    data: { snapshot: snapshotOf(layout, tier) as unknown as Prisma.InputJsonValue, circle },
  });
  return done.count && !entry.paidAt ? { weekId, theme } : null;
}

export async function enterChallenge(userId: string, now: Date): Promise<ChallengeDTO> {
  const tz = await tzOf(prisma, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  if (!theme) throw new BuddyError('no_challenge');
  if (now >= closesAt(weekId, tz)) throw new BuddyError('challenge_closed');
  const circle = await buddyIdsOf(userId);
  const { layout, created } = await prisma.$transaction(async (tx) => {
    // The room lock: a save landing at the same moment is either in the snapshot or after it, never half.
    await lockRoom(tx, userId);
    const room = await readOwnedLayout(tx, userId);
    const snapshot = snapshotOf(room.layout, room.tier) as unknown as Prisma.InputJsonValue;
    const made = await tx.challengeEntry.createMany({ data: [{ userId, weekId, snapshot, circle }], skipDuplicates: true });
    return { layout: room.layout, created: made.count === 1 };
  }, COIN_TX_OPTIONS);
  if (created) console.info(JSON.stringify({ event: 'challenge.entered' }));
  await payEntryIfMet(userId, weekId, layout, theme, now);
  return readChallenge(userId, now);
}

/** This week's and last week's unpaid entries, until each week's results: a pay that failed just before the close is
 * still paid (ruling T7-FIX). The snapshot froze at the close, so it met the brief while open. */
async function retryEntryPays(userId: string, weekId: string, now: Date): Promise<void> {
  const unpaid = await prisma.challengeEntry.findMany({ where: { userId, paidAt: null, weekId: { in: [weekId, previousWeek(weekId)] } }, select: { weekId: true, snapshot: true } });
  for (const e of unpaid) {
    const theme = themeFor(e.weekId);
    const layout = (e.snapshot as unknown as Partial<Snapshot> | null)?.layout;
    if (theme && layout && now < resultsAt(e.weekId)) await payEntryIfMet(userId, e.weekId, layout, theme, now);
  }
}

export async function readChallenge(userId: string, now: Date): Promise<ChallengeDTO> {
  await settleChallengesSafely(userId, now);
  const tz = await tzOf(prisma, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  const close = theme ? closesAt(weekId, tz) : null;
  const open = !!close && now < close;
  const buddies = await buddyIdsOf(userId);
  // The circle is frozen at the close (ruling 6): rewritten on a read while open, only when it changed (FINAL-M5).
  if (open) {
    const was = await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId } }, select: { circle: true } });
    if (was && !sameIds(was.circle, buddies)) await prisma.challengeEntry.updateMany({ where: { userId, weekId }, data: { circle: buddies } });
  }
  // A +30 that failed after its save is paid by this read, up to the week's results (rulings 7, T7-FIX).
  await retryEntryPays(userId, weekId, now);
  const mineRow = await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId } }, select: { snapshot: true, paidAt: true } });
  // Entries are seen by buddies only, never anyone blocked either way (PF4-F18).
  const hidden = new Set(await blockedEitherWay(userId));
  const visible = buddies.filter((id) => !hidden.has(id));
  const rows = theme && visible.length ? await prisma.challengeEntry.findMany({ where: { weekId, userId: { in: visible } }, select: { userId: true, snapshot: true } }) : [];
  const [people, got, mineCheers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: PERSON_SELECT }),
    prisma.challengeCheer.groupBy({ by: ['toId'], where: { weekId, toId: { in: rows.map((r) => r.userId) } }, _count: { _all: true } }),
    prisma.challengeCheer.findMany({ where: { weekId, fromId: userId }, select: { toId: true } }),
  ]);
  const cheered = new Set(mineCheers.map((c) => c.toId));
  const entries = rows.flatMap((r): EntryDTO[] => {
    const p = people.find((u) => u.id === r.userId);
    if (!p) return [];
    const person = toPerson(p);
    const snap = r.snapshot as unknown as Snapshot;
    return [{
      userId: r.userId, name: person.displayName, kipColour: person.kipColour, kipWorn: person.kipWorn,
      // Only the two snapshot keys, whatever the row holds.
      snapshot: { layout: snap.layout, size: snap.size },
      cheers: got.find((g) => g.toId === r.userId)?._count._all ?? 0,
      cheeredByMe: cheered.has(r.userId), mine: false,
    }];
  }).sort((x, y) => y.cheers - x.cheers || x.name.localeCompare(y.name));
  const mineLayout = mineRow ? (mineRow.snapshot as unknown as Snapshot).layout : null;
  return {
    week: weekId,
    theme: theme ? { id: theme.id, tag: theme.rule.tag, atLeast: theme.rule.atLeast, themePiece: theme.themePiece, trophy: theme.trophy } : null,
    closesAt: close ? close.toISOString() : null,
    open,
    entry: mineLayout && theme ? { count: briefCount(mineLayout, theme.rule.tag), meets: meetsBrief(mineLayout, theme), paid: !!mineRow!.paidAt } : null,
    entries,
    results: await readResults(userId, now),
  };
}

/** One cheer per entry per buddy per week, before the entrant's own close, paying both like a room cheer (ruling 10):
 * both room locks first (lockUsers' contract), then the checks, the row and both earns, each side from its own coins
 * launch day on (T5T7-GATE). Every refusal but the close and a repeat is the uniform 404. */
export async function cheerEntry(viewerId: string, rawTarget: string, now: Date): Promise<{ paid: boolean }> {
  if (!UUID_RE.test(rawTarget) || rawTarget === viewerId) throw NOT_FOUND();
  const toId = rawTarget;
  let written: CoinWritten[] = [];
  let paid = false;
  try {
    await prisma.$transaction(async (tx) => {
      // The first lock and the first statement (lockUsers' contract, T3-FIX): both rooms, in one global order.
      await lockUsers(tx, [viewerId, toId]);
      if (!(await findPair(viewerId, toId, tx)) || (await isBlockedEitherWay(viewerId, toId, tx))) throw NOT_FOUND();
      const [viewerTz, ownerTz] = await Promise.all([tzOf(tx, viewerId), tzOf(tx, toId)]);
      // The entrant's own week and close (Review Focus 3).
      const weekId = weekOf(now, ownerTz);
      if (!themeFor(weekId) || !(await tx.challengeEntry.findUnique({ where: { userId_weekId: { userId: toId, weekId } }, select: { weekId: true } }))) {
        throw NOT_FOUND();
      }
      if (now >= closesAt(weekId, ownerTz)) throw new BuddyError('challenge_closed');
      // A second cheer is the primary key (P2002), which ends the transaction: nothing is written.
      await tx.challengeCheer.create({ data: { weekId, fromId: viewerId, toId, createdAt: now } });
      const key = `ccheer:${weekId}:${viewerId}:${toId}`;
      const side = (tz: string, s: 'given' | 'got'): CoinEarn[] => {
        const day = localCivilDateOrUtc(now, tz);
        return paysOn(day, launchDayFor(tz)) ? [cheerEarns(key, day, s)] : [];
      };
      const given = await writeEarnsTx(tx, viewerId, side(viewerTz, 'given'), now);
      const got = await writeEarnsTx(tx, toId, side(ownerTz, 'got'), now);
      written = [...given, ...got];
      paid = given.some((w) => w.amount > 0);
    }, COIN_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) throw new BuddyError('already_cheered');
    // The entrant's account went first (FINAL-M10): the entry is gone, the uniform 404.
    if (isForeignKeyViolation(err)) throw NOT_FOUND();
    if (isRetryableTx(err)) {
      console.warn(JSON.stringify({ event: 'challenge.cheer_failed', error: err instanceof Error ? err.name : 'Error' }));
      throw new BuddyError('try_later');
    }
    throw err;
  }
  logEarned(written);
  return { paid };
}
