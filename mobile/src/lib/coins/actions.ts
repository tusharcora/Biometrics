import { randomUUID } from 'expo-crypto';
import { ApiError } from '../../api/client';
import { postExpand, postPurchase, type PurchaseDTO } from '../../api/coins';
import { applyCosmeticsBody, applyPurchase } from '../room/cosmeticsStore';
import { coinSession, setCoinBalance } from './coinsStore';

// The two coin actions (spec 2026-10-15 §6.6, §7). Never optimistic: nothing changes until the server answers, then
// both stores take the answer. Each attempt carries a request id (ruling 30): the screen keeps it for a retry after a
// network failure, so a retry is the same purchase, and drops it after any server answer. A replayed id answers the
// current balance (ruling PF-F9), which is what the store shows.

export const newRequestId = (): string => randomUUID();

/**
 * True when the server answered (an ApiError, any status): the screen drops the request id and the next attempt gets
 * a new one. Anything else (offline, a cut connection, an unreadable answer) keeps the id, so the retry is a replay.
 */
export const isServerAnswer = (err: unknown): boolean => err instanceof ApiError;

/**
 * POST /me/shop/purchases. Throws the ApiError: 409 not_enough_coins (with `needed`), 400 not_for_sale, or 400
 * invalid_body (which includes a request id reused for another piece).
 */
export async function buyPiece(itemId: string, requestId: string): Promise<PurchaseDTO> {
  const s = coinSession();
  const res = await postPurchase(requestId, itemId);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyPurchase(itemId, res.counts);
  }
  return res;
}

/**
 * POST /me/room/expand. The answer is the whole room. Throws the ApiError: 409 gate (with `coinsNeeded`,
 * `badgeNeeded`), 409 stale_tier, 400 invalid_body (which includes a request id reused for the other size), or 500
 * when the stored room can't be read (nothing is spent; the screen offers a retry).
 */
export async function growRoom(toTier: 2 | 3, requestId: string): Promise<{ stored: number; tier: number }> {
  const s = coinSession();
  const res = await postExpand(requestId, toTier);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyCosmeticsBody(res);
  }
  return { stored: res.stored, tier: res.tier };
}
