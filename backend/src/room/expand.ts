// Growing KIP's room (spec 2026-10-15 §7, §12): one size at a time, both gates always, under the user's one lock (plan
// ruling 5), so a save, a purchase and a grow never interleave. A size adds a tile row on each side, so every piece
// keeps its tile; the loft's right-wall window may cover wall pieces an 8 × 8 room used, and those (with what stands on
// them) go to the inventory (§3.2, coveredBy). A first row is created at version 1, otherwise the version always bumps.
// A tier never goes down. Coins only. Logs the spend's kind and the new tier only, never a user id or an amount.
import type { Prisma } from '@prisma/client';
import { evaluateAchievements } from '../achievements/evaluate';
import { COIN_TX_OPTIONS, balanceOf, spendInTx } from '../coins/ledger';
import { EMPTY_WORN } from '../cosmetics/catalogue';
import { readCosmetics, type CosmeticsDTO } from '../cosmetics/loadout';
import { prisma } from '../db/client';
import { isUuid } from '../lib/uuid';
import { starterLayout } from './convert';
import { coveredBy } from './geometry';
import { countsOf, geometryDeps, grantTotals, readLayout, toTier } from './layout';
import { lockRoom } from './lock';
import { TIER_GATES } from './tiers';

export type ExpandError = { error: 'invalid_body' } | { error: 'stale_tier' } | { error: 'gate'; coinsNeeded: number; badgeNeeded: boolean };
export interface ExpandFailure { status: 400 | 409; body: ExpandError }
/** The full GET /me/cosmetics body, the balance after, and how many pieces the new window sent to the inventory. */
export type ExpandBody = CosmeticsDTO & { balance: number; stored: number };

/** Exactly `{ requestId: <uuid>, toTier: 2 | 3 }`, or null. */
export function parseExpand(body: unknown): { requestId: string; toTier: 2 | 3 } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'requestId,toTier') return null;
  if (!isUuid(b.requestId) || (b.toTier !== 2 && b.toTier !== 3)) return null;
  return { requestId: b.requestId, toTier: b.toTier };
}

const INVALID: ExpandFailure = { status: 400, body: { error: 'invalid_body' } };
const keyFor = (tier: 2 | 3, requestId: string) => `expand:${tier}:${requestId}`;

/** A stored room that can't be read is never grown from the starter room (ruling T7-FIX): the grow aborts, nothing is
 * spent, and the stored JSON stays for repair. The route answers the house 500. */
export class StoredLayoutError extends Error {
  constructor() {
    super('The stored room layout cannot be read');
    this.name = 'StoredLayoutError';
  }
}

/**
 * Grows the room by one size. The spend's key names the size and the request id (ruling T7-FIX). A request id already
 * spent on this size answers 200 with the CURRENT room and balance and stored 0 (rulings PF-F9, 17); spent on the
 * other size, it is 400 invalid_body (ruling T6-FIX). Both are caught under the lock before the spend (ruling
 * T6T7-REPLAY), so spendInTx never meets the unique key. A refused request writes nothing. The covered pieces are
 * judged on the room as every read shows it (readLayout), which is also what is written back.
 */
export async function expandRoom(userId: string, body: unknown, now: Date): Promise<{ ok: true; body: ExpandBody } | { ok: false; failure: ExpandFailure }> {
  const parsed = parseExpand(body);
  if (!parsed) return { ok: false, failure: INVALID };
  const gate = TIER_GATES[parsed.toTier];
  // A level reached since the last badge load counts (ruling 18). Idempotent; on a failure the stored levels decide.
  await evaluateAchievements(userId, now, [gate.family]).catch((err: unknown) => {
    console.warn(JSON.stringify({ event: 'room.expand_badges_failed', error: err instanceof Error ? err.name : 'Error' }));
  });
  const sourceKey = keyFor(parsed.toTier, parsed.requestId);
  const keys = [keyFor(2, parsed.requestId), keyFor(3, parsed.requestId)];
  const outcome = await prisma.$transaction(async (tx): Promise<{ stored: number; grew: boolean } | ExpandFailure> => {
    await lockRoom(tx, userId);
    const spent = await tx.coinEvent.findMany({ where: { userId, sourceKey: { in: keys } }, select: { sourceKey: true } });
    if (spent.length) return spent.some((r) => r.sourceKey === sourceKey) ? { stored: 0, grew: false } : INVALID;
    const row = await tx.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, tier: true } });
    if (parsed.toTier !== toTier(row?.tier) + 1) return { status: 409, body: { error: 'stale_tier' } };
    const [have, badge] = await Promise.all([
      balanceOf(tx, userId),
      tx.achievement.findFirst({ where: { userId, family: gate.family, level: { gte: gate.level } }, select: { id: true } }),
    ]);
    if (have < gate.price || !badge) return { status: 409, body: { error: 'gate', coinsNeeded: Math.max(0, gate.price - have), badgeNeeded: !badge } };
    const paid = await spendInTx(tx, userId, 'expand', sourceKey, gate.price, now);
    if (!paid.ok) return { status: 409, body: { error: 'gate', coinsNeeded: paid.needed, badgeNeeded: false } };
    const [rows, grants] = await Promise.all([tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }), grantTotals(tx, userId)]);
    const layout = row ? readLayout(row.layout, countsOf(rows, grants)) : starterLayout();
    if (!layout) throw new StoredLayoutError();
    const gone = coveredBy(layout, parsed.toTier, geometryDeps);
    const next = { ...layout, pieces: layout.pieces.filter((p) => !gone.has(p.id)) } as unknown as Prisma.InputJsonValue;
    if (row) await tx.cosmeticLoadout.update({ where: { userId }, data: { layout: next, tier: parsed.toTier, version: { increment: 1 } } });
    else await tx.cosmeticLoadout.create({ data: { userId, layout: next, worn: { ...EMPTY_WORN }, tier: parsed.toTier, version: 1 } });
    return { stored: gone.size, grew: true };
  }, COIN_TX_OPTIONS);
  if ('status' in outcome) return { ok: false, failure: outcome };
  if (outcome.grew) {
    console.info(JSON.stringify({ event: 'coins.spent', kind: 'expand' }));
    console.info(JSON.stringify({ event: 'room.expanded', tier: parsed.toTier }));
  }
  const [dto, balance] = await Promise.all([readCosmetics(userId, now, { grant: false }), balanceOf(prisma, userId)]);
  return { ok: true, body: { ...dto, balance, stored: outcome.stored } };
}
