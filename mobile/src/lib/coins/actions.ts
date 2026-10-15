import { randomUUID } from 'expo-crypto';
import { postExpand, postPurchase, type PurchaseDTO } from '../../api/coins';
import { applyCosmeticsBody, applyPurchase } from '../room/cosmeticsStore';
import { coinSession, setCoinBalance } from './coinsStore';

// The two coin actions (spec 2026-10-15 §6.6, §7). Never optimistic: nothing changes until the server answers, then
// both stores take the answer. Each attempt carries a request id (ruling 30): the screen keeps it for a retry after a
// network failure, so a retry is the same purchase, and drops it after any server answer. A replayed id answers the
// current balance (ruling PF-F9), which is what the store shows.

export const newRequestId = (): string => randomUUID();

/** POST /me/shop/purchases. Throws the ApiError (409 not_enough_coins with `needed`, 400 not_for_sale). */
export async function buyPiece(itemId: string, requestId: string): Promise<PurchaseDTO> {
  const s = coinSession();
  const res = await postPurchase(requestId, itemId);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyPurchase(itemId, res.counts);
  }
  return res;
}

/** POST /me/room/expand. The answer is the whole room. Throws the ApiError (409 gate, 409 stale_tier). */
export async function growRoom(toTier: 2 | 3, requestId: string): Promise<{ stored: number; tier: number }> {
  const s = coinSession();
  const res = await postExpand(requestId, toTier);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyCosmeticsBody(res);
  }
  return { stored: res.stored, tier: res.tier };
}
