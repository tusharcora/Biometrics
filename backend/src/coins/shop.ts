// The coin shop (spec 2026-10-15 §6.4–6.6). A piece is for sale when it is shipped, priced and offered this week
// (always, in a week whose challenge theme names it, or in its own ISO week), never a prize (a trophy, P4 ruling 2),
// and, for a piece with an unlock rule, once its unlock row exists (§6.5: a rule piece is never sold before it is
// earned; a gifted copy does not count, P4 ruling 15). The offer marks such a piece locked until then (PF4-F1). A
// purchase runs under the user's one lock (plan ruling 5): the replay check, the sale check, the spend, then the +1
// grant, all keyed by the app's request id, so a retry never buys twice. Coins only: nothing here is ever paid for with
// money. Logs the spend's kind only, never a user id, an item or an amount.
import type { Prisma } from '@prisma/client';
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { themeFor } from '../challenges/themes';
import { COSMETIC_ITEMS, isShipped, type CosmeticItem } from '../cosmetics/catalogue';
import { prisma } from '../db/client';
import { isoWeekKey } from '../habits/job';
import { isUuid } from '../lib/uuid';
import { countsOf, grantTotals } from '../room/layout';
import { lockRoom } from '../room/lock';
import { todayFor } from '../social/checkins';
import { COIN_TX_OPTIONS, balanceOf, spendInTx } from './ledger';
import { weekSet } from './shopWeeks';

export interface ShopOffer { itemId: string; price: number }
/** An offer as GET /me/shop sends it: `locked` is a rule piece not earned yet, shown but never sold (PF4-F1). */
export interface ShopItem extends ShopOffer { locked: boolean }
export interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: ShopItem[] }

export function offeredIn(week: string, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer[] {
  return items
    .filter((i) => isShipped(i) && !!i.iso && i.price !== undefined && i.unlock.kind !== 'prize' && (
      i.shop === 'always'
      || (i.shop === 'theme' && themeFor(week)?.themePiece === i.id)
      || (typeof i.shop === 'object' && i.shop.week === week)))
    .map((i) => ({ itemId: i.id, price: i.price! }));
}

/** A shop piece and a starter are for anyone; a rule piece only once its unlock row exists; a prize never. */
const sellsTo = (item: CosmeticItem, earned: ReadonlySet<string>): boolean =>
  item.unlock.kind !== 'prize' && (item.unlock.kind === 'shop' || item.unlock.kind === 'starter' || earned.has(item.id));

/** A shop piece and a starter are for anyone; a rule piece only once its unlock row exists, never because a gift or a
 * prize gave a copy (spec §6.5; P4 ruling 15 resolves P2's note). */
export function forSale(itemId: string, week: string, earned: ReadonlySet<string>, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer | null {
  const offer = offeredIn(week, items).find((o) => o.itemId === itemId);
  const item = items.find((i) => i.id === itemId);
  if (!offer || !item) return null;
  return sellsTo(item, earned) ? offer : null;
}

/** The items a user has earned: their unlock rows (never their grants). */
async function earnedBy(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<Set<string>> {
  return new Set((await db.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } })).map((r) => r.itemId));
}

/** The user's local ISO week ('2026-W43'). */
export async function shopWeek(userId: string, now: Date): Promise<string> {
  const { today } = await todayFor(userId, now);
  return isoWeekKey(civilDateToUtcMidnight(today));
}

export async function readShop(userId: string, now: Date): Promise<ShopDTO> {
  const [week, earned] = await Promise.all([shopWeek(userId, now), earnedBy(prisma, userId)]);
  const offers = offeredIn(week);
  const offered = new Set(offers.map((i) => i.itemId));
  const byId = new Map(COSMETIC_ITEMS.map((i) => [i.id, i]));
  const items = offers.map((o) => ({ ...o, locked: !sellsTo(byId.get(o.itemId)!, earned) }));
  const set = weekSet(week);
  return { week, set: { id: set.id, itemIds: set.itemIds.filter((id) => offered.has(id)) }, items };
}

/** Exactly `{ requestId: <uuid>, itemId }`, or null. */
export function parsePurchase(body: unknown): { requestId: string; itemId: string } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'itemId,requestId') return null;
  if (!isUuid(b.requestId)) return null;
  if (typeof b.itemId !== 'string' || b.itemId.length === 0 || b.itemId.length > 64) return null;
  return { requestId: b.requestId, itemId: b.itemId };
}

type Refused =
  | { ok: false; status: 400; body: { error: 'invalid_body' | 'not_for_sale' } }
  | { ok: false; status: 409; body: { error: 'not_enough_coins'; needed: number } };
export type PurchaseResult = { ok: true; body: { balance: number; counts: Record<string, number> } } | Refused;

/**
 * Buys one copy. A request id already spent answers 200 with the CURRENT balance and counts, not the first answer
 * (ruling PF-F9): the app only needs to know the purchase landed, and the wallet may have moved since. The replay is
 * caught under the lock before the spend (ruling T6T7-REPLAY), so spendInTx never meets the unique key (a P2002
 * would abort the transaction). The same id for a different piece is 400 invalid_body and writes nothing. A refused
 * request writes nothing, so its retry is judged afresh.
 */
export async function buyPiece(userId: string, body: unknown, now: Date): Promise<PurchaseResult> {
  const parsed = parsePurchase(body);
  if (!parsed) return { ok: false, status: 400, body: { error: 'invalid_body' } };
  const sourceKey = `buy:${parsed.requestId}`;
  const week = await shopWeek(userId, now);
  const outcome = await prisma.$transaction(async (tx): Promise<'bought' | 'replay' | Refused> => {
    await lockRoom(tx, userId);
    const [spent, granted] = await Promise.all([
      tx.coinEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey } }, select: { id: true } }),
      tx.itemGrant.findUnique({ where: { userId_sourceKey: { userId, sourceKey } }, select: { itemId: true } }),
    ]);
    // A request id names one purchase: reused for another piece, it is a bad request, not a replay (ruling T6-FIX).
    if (granted && granted.itemId !== parsed.itemId) return { ok: false, status: 400, body: { error: 'invalid_body' } };
    if (spent || granted) return 'replay';
    const offer = forSale(parsed.itemId, week, await earnedBy(tx, userId));
    if (!offer) return { ok: false, status: 400, body: { error: 'not_for_sale' } };
    const paid = await spendInTx(tx, userId, 'buy', sourceKey, offer.price, now);
    if (!paid.ok) return { ok: false, status: 409, body: { error: 'not_enough_coins', needed: paid.needed } };
    await tx.itemGrant.create({ data: { userId, itemId: parsed.itemId, qty: 1, sourceKey } });
    return 'bought';
  }, COIN_TX_OPTIONS);
  if (typeof outcome !== 'string') return outcome;
  if (outcome === 'bought') console.info(JSON.stringify({ event: 'coins.spent', kind: 'buy' }));
  const [rows, grants, balance] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
    grantTotals(prisma, userId),
    balanceOf(prisma, userId),
  ]);
  return { ok: true, body: { balance, counts: countsOf(rows, grants) } };
}
