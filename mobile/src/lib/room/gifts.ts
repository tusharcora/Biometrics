// Gifts, the pure parts (spec 2026-10-15 §10.3; P4 rulings 11, 14, PF4-F8): which pieces are spares (a placeable
// piece owned twice with one not placed; you always keep one), and where the gift boxes stand on the KIP page's room
// card: free tiles the card shows, the frontmost rows first (the cat's in-view row logic, P3 T11-ROW), never on a
// piece's footprint, KIP's chair or the tile out of it. The boxes are not placements: they never enter the layout or
// the room picture, and the cat and KIP keep off their tiles.
import { CATALOGUE, isoOf } from './catalogue';
import type { Box } from './grid';
import { deskBoxes, isoCrop } from './iso/crop';
import { exitTile, footOf, placedCounts, seatTile, type RoomLayout, type Tier } from './iso/geometry';
import { isoGrid, projOf } from './iso/grid';
import type { ItemId } from './loadout';

export interface Spare { itemId: ItemId; spare: number }

/** Spares in catalogue order: owned ≥ 2 and owned − placed ≥ 1; you keep one, so at most owned − 1. A trophy is never
 * a spare, even a second copy from a repeated theme: it must mean you won it (ruling FINAL-M3, as the server refuses). */
export function spareTiles(counts: Readonly<Record<ItemId, number>>, layout: RoomLayout): Spare[] {
  const placed = placedCounts(layout);
  return CATALOGUE.items.flatMap((i): Spare[] => {
    const owned = counts[i.id] ?? 0;
    const free = owned - (placed[i.id] ?? 0);
    return i.iso && i.unlock.kind !== 'prize' && owned >= 2 && free >= 1 ? [{ itemId: i.id, spare: Math.min(owned - 1, free) }] : [];
  });
}

export const MAX_BOXES = 3;
/** The room card draws at 2 pt a cell; a box is a 44-pt button whose bottom sits 10 pt under its tile's centre. */
export const GIFT_CELL_PT = 2;
export const BOX_PT = 44;
const BOX_DROP_PT = 10;

/** A box's top-left in the view, in points, from its tile's centre point. */
export function boxAt(point: { x: number; y: number }): { left: number; top: number } {
  return { left: point.x - BOX_PT / 2, top: point.y + BOX_DROP_PT - BOX_PT };
}

/** The room card's crop as RoomView makes it: the room's offset in points and the view in room cells. */
export function giftCrop(layout: RoomLayout, tier: Tier, width: number, height: number): { offset: { x: number; y: number }; view: Box } {
  const g = isoGrid(tier);
  const offset = isoCrop({ width, height, cellPt: GIFT_CELL_PT, box: deskBoxes(g, layout).focus, room: g });
  return { offset, view: { x: -offset.x / GIFT_CELL_PT, y: -offset.y / GIFT_CELL_PT, w: width / GIFT_CELL_PT, h: height / GIFT_CELL_PT } };
}

/** A tile's box fits wholly inside `view` (room cells). */
function boxInView(tier: Tier, tile: readonly [number, number], view: Box): boolean {
  const c = giftPoint(tier, tile, { x: 0, y: 0 }, GIFT_CELL_PT);
  const { left, top } = boxAt(c);
  const [x, y, s] = [left / GIFT_CELL_PT, top / GIFT_CELL_PT, BOX_PT / GIFT_CELL_PT];
  return x >= view.x && y >= view.y && x + s <= view.x + view.w && y + s <= view.y + view.h;
}

/**
 * Up to min(count, 3) free tiles, row by row from the front (j = m − 1, the row nearest you), each from the left wall
 * along. With `view`, only tiles whose box the card shows whole (PF4-F8): in a bigger room the crop cuts the front
 * row off, so the boxes stand on the frontmost rows it does show.
 */
export function giftTiles(layout: RoomLayout, tier: Tier, count: number, view: Box | null = null): Array<[number, number]> {
  const { n, m } = isoGrid(tier);
  const taken = new Set<string>();
  for (const p of layout.pieces) {
    const iso = p.layer === 'floor' ? isoOf(p.item) : undefined;
    if (!iso || iso.flat) continue;
    const a = footOf(p, iso);
    for (let i = a.x0; i < a.x1; i++) for (let j = a.y0; j < a.y1; j++) taken.add(`${i},${j}`);
    for (const t of [seatTile(p, iso), exitTile(p, iso)]) if (t) taken.add(`${t[0]},${t[1]}`);
  }
  const want = Math.min(count, MAX_BOXES);
  const out: Array<[number, number]> = [];
  for (let j = m - 1; j >= 0 && out.length < want; j--) {
    for (let i = 0; i < n && out.length < want; i++) {
      if (!taken.has(`${i},${j}`) && (!view || boxInView(tier, [i, j], view))) out.push([i, j]);
    }
  }
  return out;
}

/** A box's centre in the view, in whole points: the tile's centre projected, at the room's offset. */
export function giftPoint(tier: Tier, tile: readonly [number, number], offset: { x: number; y: number }, cellPt: number): { x: number; y: number } {
  const [x, y] = projOf(isoGrid(tier))(tile[0] + 0.5, tile[1] + 0.5);
  return { x: Math.round(x * cellPt + offset.x), y: Math.round(y * cellPt + offset.y) };
}
