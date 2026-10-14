// grantCosmetics (spec 2026-10-14 KIP's room §3.1): idempotent and safe to run concurrently. createManyAndReturn +
// skipDuplicates returns only the rows THIS call inserted, so a concurrent call that lost the race announces nothing.
// Called after new badge levels, after a recap is first opened, after a sticker is sent, and by GET /me/cosmetics.
// Logs a count only: never the user id with item ids.
import { prisma } from '../db/client';
import { COSMETICS_RELEASE, COSMETIC_ITEMS, COSMETIC_SETS, RELEASE_LAUNCHED_AT, type CosmeticItem, type CosmeticRelease, type CosmeticSet } from './catalogue';
import { loadUnlockFacts } from './facts';
import { planGrants, type PlannedGrant } from './rules';

export interface GrantOptions {
  release?: number;
  launchedAt?: Readonly<Partial<Record<CosmeticRelease, Date>>>;
  items?: readonly CosmeticItem[];
  sets?: readonly CosmeticSet[];
}

export async function grantCosmetics(userId: string, now: Date, opts: GrantOptions = {}): Promise<PlannedGrant[]> {
  const [facts, rows] = await Promise.all([
    loadUnlockFacts(userId),
    prisma.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
  ]);
  const planned = planGrants({
    items: opts.items ?? COSMETIC_ITEMS,
    sets: opts.sets ?? COSMETIC_SETS,
    facts,
    owned: new Set(rows.map((r) => r.itemId)),
    release: opts.release ?? COSMETICS_RELEASE,
    launchedAt: opts.launchedAt ?? RELEASE_LAUNCHED_AT,
  });
  if (planned.length === 0) return [];
  const created = await prisma.cosmeticUnlock.createManyAndReturn({
    data: planned.map((p) => ({ userId, itemId: p.itemId, source: p.source, unlockedAt: now })),
    skipDuplicates: true,
    select: { itemId: true, source: true },
  });
  if (created.length > 0) console.info(JSON.stringify({ event: 'cosmetics.granted', count: created.length }));
  return created;
}

/** The grant the hooks call; tests swap it to prove a failure never fails the request that triggered it. */
export const cosmeticsHooks: { grant: (userId: string, now: Date) => Promise<unknown> } = {
  grant: (userId, now) => grantCosmetics(userId, now),
};

/** Never throws: a failed grant is logged without values and the next GET /me/cosmetics catches up. */
export async function grantCosmeticsSafely(userId: string, now: Date): Promise<void> {
  try {
    await cosmeticsHooks.grant(userId, now);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'cosmetics.grant_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}
