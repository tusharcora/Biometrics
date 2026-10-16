// The free-build layout on the app's side (spec 2026-10-15 §2.2, §2.3): the starter layout, reading a stored one,
// counts and the inventory ("×n" in the drawer), children, the desk, stable keys and new instance ids. The placement
// rules live once, in the geometry copy (ruling T2): placedCounts is that file's, re-exported.
import { CATALOGUE, isoOf } from './catalogue';
import type { ItemId } from './loadout';
import { parseLayout, placedCounts, type Placement, type RoomLayout } from './iso/geometry';

export { placedCounts };

export function starterLayout(): RoomLayout {
  return JSON.parse(JSON.stringify(CATALOGUE.starterLayout)) as RoomLayout;
}

/** A layout from the server, or the starter one when the value is not a layout (an older or broken body). */
export function readLayout(value: unknown): RoomLayout {
  return parseLayout(value) ?? starterLayout();
}

/** owned − placed for every owned item (spec §2.2), never below zero. */
export function inventoryOf(counts: Readonly<Record<ItemId, number>>, layout: RoomLayout): Record<ItemId, number> {
  const placed = placedCounts(layout);
  const out: Record<ItemId, number> = {};
  for (const [id, n] of Object.entries(counts)) out[id] = Math.max(0, n - (placed[id] ?? 0));
  return out;
}

export function childrenOf(layout: RoomLayout, id: string): Placement[] {
  return layout.pieces.filter((p) => p.layer === 'onTop' && p.parent === id).sort((a, b) => (a.spot ?? 0) - (b.spot ?? 0));
}

export function deskOf(layout: RoomLayout): Placement | undefined {
  return layout.pieces.filter((p) => p.layer === 'floor' && isoOf(p.item)?.kipDesk).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
}

/** One placement's content, for memo keys (a run's picture key, ruling 11). */
export const pieceKey = (p: Placement) => [p.id, p.item, p.layer, p.x, p.y, p.facing, p.mirror ? 1 : 0, p.parent ?? '', p.spot ?? ''].join(',');
/** A stable key of a layout's content (memo keys): piece order does not matter. */
export function layoutKey(layout: RoomLayout): string {
  return `${layout.styles.wallpaper},${layout.styles.floor},${layout.styles.window}|${layout.pieces.map(pieceKey).sort().join(';')}`;
}

/** The lowest unused id of the form p1, p2, … (plan ruling 10). */
export function newPieceId(layout: RoomLayout): string {
  const used = new Set(layout.pieces.map((p) => p.id));
  for (let k = 1; ; k++) if (!used.has(`p${k}`)) return `p${k}`;
}
