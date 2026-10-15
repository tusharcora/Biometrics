// Reading a stored layout (spec 2026-10-15 §2.2): what you own is a count; a stored layout that places more copies
// than you own (or an item this server does not ship) is trimmed at read, never rewritten until the next save.
import type { Prisma } from '@prisma/client';
import { STARTER_IDS, shippedItem } from '../cosmetics/catalogue';
import { prisma } from '../db/client';
import { starterLayout } from './convert';
import { STYLE_KEYS, parseLayout, type GeometryDeps, type Placement, type RoomLayout } from './geometry';

// The rules live once, in geometry.ts (plan ruling T2): re-exported here, never redefined.
export { placedCounts, toTier } from './geometry';

export const geometryDeps: GeometryDeps = { isoOf: (id) => shippedItem(id)?.iso };

/**
 * owned(item) = starter 1 + an unlock row's `grants ?? 1` + the item's ItemGrant sum (spec §2.2). Shipped items only;
 * an item whose count comes to 0 is left out.
 */
export function countsOf(rows: ReadonlyArray<{ itemId: string }>, grants: ReadonlyArray<{ itemId: string; qty: number }> = []): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of STARTER_IDS) counts[id] = 1;
  for (const { itemId } of rows) {
    const item = shippedItem(itemId);
    if (item && item.unlock.kind !== 'starter') counts[itemId] = (counts[itemId] ?? 0) + (item.grants ?? 1);
  }
  for (const { itemId, qty } of grants) {
    if (!shippedItem(itemId)) continue;
    const n = (counts[itemId] ?? 0) + qty;
    if (n > 0) counts[itemId] = n;
    else delete counts[itemId];
  }
  return counts;
}

/** Each item's ItemGrant sum for a user (bought copies in P2). */
export async function grantTotals(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<Array<{ itemId: string; qty: number }>> {
  const rows = await db.itemGrant.groupBy({ by: ['itemId'], where: { userId }, _sum: { qty: true } });
  return rows.map((r) => ({ itemId: r.itemId, qty: r._sum.qty ?? 0 }));
}

/** Drops pieces whose parent is gone (one level of stacking, so one pass is enough). */
const withParents = (pieces: Placement[]): Placement[] => {
  const ids = new Set(pieces.map((p) => p.id));
  return pieces.filter((p) => p.layer !== 'onTop' || ids.has(p.parent!));
};

/**
 * A stored layout as the user may see it (plan ruling 23), or null when the JSON is not a layout (the caller uses the
 * starter): unknown or unshipped pieces go with their children, copies over the owned count go newest first with
 * their children, and an unowned style reads as the starter style.
 */
export function readLayout(json: unknown, counts: Readonly<Record<string, number>>): RoomLayout | null {
  const parsed = parseLayout(json);
  if (!parsed) return null;
  const starter = starterLayout();
  const styles = { ...parsed.styles };
  for (const k of STYLE_KEYS) {
    const item = shippedItem(styles[k]);
    if (!item || item.slot !== k || !((counts[styles[k]] ?? 0) > 0)) styles[k] = starter.styles[k];
  }
  const known = withParents(parsed.pieces.filter((p) => !!shippedItem(p.item)?.iso));
  // Base pieces first, then the children their drops orphan, then the onTop pieces against what is left of each
  // count (ruling T4-CARRY): a child that leaves with its parent frees its copy, so only the true excess drops.
  const base = trimOver(known.filter((p) => p.layer !== 'onTop'), counts, {});
  const baseIds = new Set(base.map((p) => p.id));
  const kept = withParents(known.filter((p) => p.layer === 'onTop' || baseIds.has(p.id)));
  const used: Record<string, number> = {};
  for (const p of base) used[p.item] = (used[p.item] ?? 0) + 1;
  const onTop = new Set(trimOver(kept.filter((p) => p.layer === 'onTop'), counts, used).map((p) => p.id));
  return { v: 1, styles, pieces: kept.filter((p) => p.layer !== 'onTop' || onTop.has(p.id)) };
}

/** An app instance id is p1, p2, … (P1 ruling P10): its n. Any other id (a starter's or a converted room's) is 0. */
const idRank = (id: string): number => {
  const m = /^p(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
};

/** The newest copies first (ruling PF-F1, replacing plan ruling 31's id length): the highest rank, then id descending. */
const newestFirst = (a: Placement, b: Placement) => idRank(b.id) - idRank(a.id) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** Keeps at most `counts[item] - used[item]` copies of each item, dropping the newest first; order is kept. */
function trimOver(pieces: Placement[], counts: Readonly<Record<string, number>>, used: Readonly<Record<string, number>>): Placement[] {
  const drop = new Set<string>();
  const byItem = new Map<string, Placement[]>();
  for (const p of pieces) byItem.set(p.item, [...(byItem.get(p.item) ?? []), p]);
  for (const [item, list] of byItem) {
    const extra = list.length - Math.max(0, (counts[item] ?? 0) - (used[item] ?? 0));
    if (extra > 0) [...list].sort(newestFirst).slice(0, extra).forEach((p) => drop.add(p.id));
  }
  return pieces.filter((p) => !drop.has(p.id));
}
