// Reading a stored layout (spec 2026-10-15 §2.2): what you own is a count; a stored layout that places more copies
// than you own (or an item this server does not ship) is trimmed at read, never rewritten until the next save.
import { STARTER_IDS, shippedItem } from '../cosmetics/catalogue';
import { starterLayout } from './convert';
import { STYLE_KEYS, parseLayout, type GeometryDeps, type Placement, type RoomLayout } from './geometry';

// The rules live once, in geometry.ts (plan ruling T2): re-exported here, never redefined.
export { placedCounts, toTier } from './geometry';

export const geometryDeps: GeometryDeps = { isoOf: (id) => shippedItem(id)?.iso };

/** owned(item) = starter 1 + an unlock row's `grants ?? 1` (P2 adds ItemGrant sums). Shipped items only. */
export function countsOf(rows: ReadonlyArray<{ itemId: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of STARTER_IDS) counts[id] = 1;
  for (const { itemId } of rows) {
    const item = shippedItem(itemId);
    if (item && item.unlock.kind !== 'starter') counts[itemId] = (counts[itemId] ?? 0) + (item.grants ?? 1);
  }
  return counts;
}

/** Drops pieces whose parent is gone (one level of stacking, so one pass is enough). */
const withParents = (pieces: Placement[]): Placement[] => {
  const ids = new Set(pieces.map((p) => p.id));
  return pieces.filter((p) => p.layer !== 'onTop' || ids.has(p.parent!));
};

/**
 * A stored layout as the user may see it (plan ruling 23), or null when the JSON is not a layout (the caller uses the
 * starter): unknown or unshipped pieces go with their children, copies over the owned count go highest id first with
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
  const drop = new Set<string>();
  const byItem = new Map<string, Placement[]>();
  for (const p of known) byItem.set(p.item, [...(byItem.get(p.item) ?? []), p]);
  for (const [item, list] of byItem) {
    const extra = list.length - (counts[item] ?? 0);
    if (extra > 0) [...list].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, extra).forEach((p) => drop.add(p.id));
  }
  return { v: 1, styles, pieces: withParents(known.filter((p) => !drop.has(p.id))) };
}
