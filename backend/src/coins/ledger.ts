// The KIP coin ledger (spec 2026-10-15 §6.3). One function writes every earned coin, under the user's one lock (plan
// ruling 5), append-only: it drops events whose source key is already written BEFORE trimming, so a replay never uses
// up cap room a new event needs; trims capped kinds in a fixed order (kind, then key) to what is left of their cap
// day's 60; writes a 0-coin row (already seen) when nothing is left, so the key is used up and the event still counts;
// pays at most 5 cheers a day, given and received together; and adds what it wrote to the wallet. Spends (buy,
// expand) run inside the caller's transaction and take the same lock. Logs kinds and counts only, never a user id, a
// key or an amount.
import type { Prisma } from '@prisma/client';
import { civilDateToUtcMidnight, utcMidnightToCivilDate } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { lockRoom } from '../room/lock';
import { DAILY_CAP } from './amounts';

export { DAILY_CAP };
export const PAID_CHEERS_A_DAY = 5;
export const CAPPED_KINDS = ['sleep_goal', 'steps', 'checkin', 'recap', 'cheer_given', 'cheer_got'] as const;
export const EARN_KINDS = [...CAPPED_KINDS, 'challenge', 'firstweek'] as const;
export type CappedKind = (typeof CAPPED_KINDS)[number];
export type EarnKind = (typeof EARN_KINDS)[number];
export type UncappedKind = Exclude<EarnKind, CappedKind>;
export type SpendKind = 'buy' | 'expand';
export type CoinKind = EarnKind | SpendKind;

/** One earn of a positive whole number of coins. capDay is the source's own civil date ('YYYY-MM-DD') for a capped
 * kind, which must have one (it would skip the cap otherwise), and null for an uncapped one. */
export type CoinEarn =
  | { kind: CappedKind; sourceKey: string; amount: number; capDay: string }
  | { kind: UncappedKind; sourceKey: string; amount: number; capDay: null };
export interface CoinWritten { kind: EarnKind; amount: number }
/** What each cap day has used: coins over the capped kinds, and the cheers that paid. */
export type DayUse = Map<string, { coins: number; paidCheers: number }>;

const CAPPED: ReadonlySet<string> = new Set(CAPPED_KINDS);
const EARNS: ReadonlySet<string> = new Set(EARN_KINDS);
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHEERS: ReadonlySet<string> = new Set(['cheer_given', 'cheer_got']);
export const isCapped = (kind: string): kind is CappedKind => CAPPED.has(kind);
const byKindThenKey = (a: CoinEarn, b: CoinEarn) =>
  (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0);

const isWholeCoins = (n: number) => Number.isInteger(n) && n > 0;

/** Throws on an earn the ledger must never write: an unknown kind, a non-positive or fractional amount, or a capped
 * kind without its civil day (or an uncapped one with a day). A programming error, never a user's input. */
function checkEarn(e: CoinEarn): void {
  if (!EARNS.has(e.kind)) throw new Error('coins: unknown earn kind');
  if (!isWholeCoins(e.amount)) throw new Error('coins: an earn is a positive whole number of coins');
  if (isCapped(e.kind) ? typeof e.capDay !== 'string' || !CIVIL_DATE.test(e.capDay) : e.capDay !== null) {
    throw new Error('coins: a capped earn needs its civil day, an uncapped one has none');
  }
}

/** The amounts new earns get (pure). `used` is updated as they are planned. */
export function planCapped(fresh: readonly CoinEarn[], used: DayUse): CoinEarn[] {
  fresh.forEach(checkEarn);
  return [...fresh].sort(byKindThenKey).map((e) => {
    if (e.capDay === null) return e;
    const day = used.get(e.capDay) ?? { coins: 0, paidCheers: 0 };
    const cheer = CHEERS.has(e.kind);
    const left = Math.max(0, DAILY_CAP - day.coins);
    const amount = cheer && day.paidCheers >= PAID_CHEERS_A_DAY ? 0 : Math.max(0, Math.min(e.amount, left));
    used.set(e.capDay, { coins: day.coins + amount, paidCheers: day.paidCheers + (cheer && amount > 0 ? 1 : 0) });
    return { ...e, amount };
  });
}

async function writeEarns(tx: Prisma.TransactionClient, userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  // Two earns with one key in a batch: the last one is kept (a key is paid once, whichever amount it carries).
  const unique = [...new Map(events.map((e) => [e.sourceKey, e])).values()];
  const have = await tx.coinEvent.findMany({ where: { userId, sourceKey: { in: unique.map((e) => e.sourceKey) } }, select: { sourceKey: true } });
  const known = new Set(have.map((r) => r.sourceKey));
  const fresh = unique.filter((e) => !known.has(e.sourceKey));
  if (!fresh.length) return [];
  const days = [...new Set(fresh.flatMap((e) => (e.capDay === null ? [] : [e.capDay])))];
  const used: DayUse = new Map();
  if (days.length) {
    const rows = await tx.coinEvent.findMany({
      where: { userId, kind: { in: [...CAPPED_KINDS] }, capDay: { in: days.map(civilDateToUtcMidnight) } },
      select: { kind: true, amount: true, capDay: true },
    });
    for (const r of rows) {
      const day = utcMidnightToCivilDate(r.capDay!);
      const u = used.get(day) ?? { coins: 0, paidCheers: 0 };
      used.set(day, { coins: u.coins + r.amount, paidCheers: u.paidCheers + (CHEERS.has(r.kind) && r.amount > 0 ? 1 : 0) });
    }
  }
  const created = await tx.coinEvent.createManyAndReturn({
    data: planCapped(fresh, used).map((e) => ({
      userId, kind: e.kind, sourceKey: e.sourceKey, amount: e.amount,
      capDay: e.capDay === null ? null : civilDateToUtcMidnight(e.capDay),
      // Nothing to land (plan ruling 6): a 0-coin row is seen from the start.
      seenAt: e.amount === 0 ? now : null,
    })),
    skipDuplicates: true,
    select: { kind: true, amount: true },
  });
  const total = created.reduce((n, r) => n + r.amount, 0);
  await tx.coinWallet.upsert({ where: { userId }, create: { userId, balance: total }, update: { balance: { increment: total } } });
  return created.map((r) => ({ kind: r.kind as EarnKind, amount: r.amount }));
}

/** Room for the wait on the user's room lock (a save, a purchase or a grow may hold it) beyond Prisma's 2 s / 5 s
 * defaults. Past them the call rejects (P2028) and writes nothing: the caller logs and drops it, and the next earn
 * pass pays the same keys. */
export const COIN_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Writes the earns this user has not been paid for yet; answers only what this call wrote. Throws on a malformed
 * earn (checkEarn) and when the transaction times out. */
export async function applyCoinEvents(userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  if (!events.length) return [];
  events.forEach(checkEarn);
  const written = await prisma.$transaction(async (tx) => {
    await lockRoom(tx, userId);
    return writeEarns(tx, userId, events, now);
  }, COIN_TX_OPTIONS);
  const counts = new Map<string, number>();
  for (const w of written) counts.set(w.kind, (counts.get(w.kind) ?? 0) + 1);
  for (const [kind, count] of counts) console.info(JSON.stringify({ event: 'coins.earned', kind, count }));
  return written;
}

export type Spent = { ok: true; balance: number } | { ok: false; needed: number };

/** A spend inside the caller's transaction: the room lock (re-entrant, so a caller already holding it is fine), the
 * balance, then the row (seen) and the wallet. A replayed key is the caller's to catch first (it would abort the
 * transaction on the unique key). */
export async function spendInTx(tx: Prisma.TransactionClient, userId: string, kind: SpendKind, sourceKey: string, price: number, now: Date): Promise<Spent> {
  if (!isWholeCoins(price)) throw new Error('coins: a price is a positive whole number of coins');
  await lockRoom(tx, userId);
  const have = await balanceOf(tx, userId);
  if (have < price) return { ok: false, needed: price - have };
  await tx.coinEvent.create({ data: { userId, kind, sourceKey, amount: -price, capDay: null, seenAt: now } });
  const wallet = await tx.coinWallet.update({ where: { userId }, data: { balance: { decrement: price } }, select: { balance: true } });
  return { ok: true, balance: wallet.balance };
}

export async function balanceOf(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<number> {
  return (await db.coinWallet.findUnique({ where: { userId }, select: { balance: true } }))?.balance ?? 0;
}
