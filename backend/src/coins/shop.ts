// The coin shop (spec 2026-10-15 §6.4–6.6). A piece is for sale when it is shipped, priced and offered this week
// (always, or in its own ISO week), and, for a piece with an unlock rule, once you own it (§6.5: a rule piece is never
// sold before it is earned). A purchase runs under the user's one lock (plan ruling 5): the replay check, the sale
// check, the spend, then the +1 grant, all keyed by the app's request id, so a retry never buys twice. Coins only:
// nothing here is ever paid for with money. Logs the spend's kind only, never a user id, an item or an amount.
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
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
export interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: ShopOffer[] }

export function offeredIn(week: string, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer[] {
  return items
    .filter((i) => isShipped(i) && !!i.iso && i.price !== undefined && (i.shop === 'always' || (typeof i.shop === 'object' && i.shop.week === week)))
    .map((i) => ({ itemId: i.id, price: i.price! }));
}

export function forSale(itemId: string, week: string, counts: Readonly<Record<string, number>>, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer | null {
  const offer = offeredIn(week, items).find((o) => o.itemId === itemId);
  const item = items.find((i) => i.id === itemId);
  if (!offer || !item) return null;
  const anyone = item.unlock.kind === 'shop' || item.unlock.kind === 'starter';
  return anyone || (counts[itemId] ?? 0) > 0 ? offer : null;
}

/** The user's local ISO week ('2026-W43'). */
export async function shopWeek(userId: string, now: Date): Promise<string> {
  const { today } = await todayFor(userId, now);
  return isoWeekKey(civilDateToUtcMidnight(today));
}

export async function readShop(userId: string, now: Date): Promise<ShopDTO> {
  const week = await shopWeek(userId, now);
  const items = offeredIn(week);
  const offered = new Set(items.map((i) => i.itemId));
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
    const [rows, grants] = await Promise.all([tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }), grantTotals(tx, userId)]);
    const offer = forSale(parsed.itemId, week, countsOf(rows, grants));
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
