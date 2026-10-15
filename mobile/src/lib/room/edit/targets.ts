// Where a piece can go (spec 2026-10-15 §5.3, §5.4, §5.7): snapping a finger's point to a tile, the wall grid or the
// nearest free spot; why a place is refused (layer, cap, geometry); the nearest free valid place for Place and
// Another; Put on…'s surfaces and the floor; the guided first placement's tile. Pure. The geometry is the server's
// (iso/geometry.ts).
import { GEOMETRY_DEPS, isoOf } from '../catalogue';
import { capFor, checkPiece, footOf, seatTile, wallLength, WALL_STEPS, wrongLayer, type BadReason, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import { HH, HT, projOf, unproject, type IsoGrid } from '../iso/grid';
import { spotPoint } from '../iso/room';
import type { ItemId } from '../loadout';
import type { EditorState } from './editor';
import { pieceNoun } from './labels';

export type Target =
  | { layer: 'floor' | 'wallL' | 'wallR'; x: number; y: number }
  | { layer: 'onTop'; parent: string; spot: number };

export interface Refused {
  /** `none` and `sameDesk`: Replace desk with a desk you have none left of, or the one already there (UI-OUTCOMES). */
  reason: BadReason | 'layer' | 'full' | 'none' | 'sameDesk';
  with?: string;
}

type Base = Pick<Placement, 'id' | 'item' | 'facing' | 'mirror'>;

export function placedAt(base: Base, t: Target): Placement {
  const { id, item, facing, mirror } = base;
  return t.layer === 'onTop'
    ? { id, item, layer: 'onTop', x: 0, y: 0, facing, mirror, parent: t.parent, spot: t.spot }
    : { id, item, layer: t.layer, x: t.x, y: t.y, facing, mirror };
}

/** Why `piece` can't go where it is (its own entry ignored), or null. `adding` counts it against the cap. */
export function refusal(layout: RoomLayout, piece: Placement, tier: Tier, adding: boolean): Refused | null {
  const iso = isoOf(piece.item);
  // Layer first (ruling T2): checkPiece assumes an allowed layer, and a missing iso reads as 'outside' there.
  if (!iso || wrongLayer(iso, piece)) return { reason: 'layer' };
  if (adding && layout.pieces.length >= capFor(tier)) return { reason: 'full' };
  const why = checkPiece(layout, piece, tier, GEOMETRY_DEPS);
  // On KIP's chair itself (inside the desk's footprint, so the overlap answers first): say the chair (final review M1).
  if (why?.reason === 'overlap' && piece.layer === 'floor') {
    const desk = layout.pieces.find((q) => q.id === why.with);
    const deskIso = desk ? isoOf(desk.item) : undefined;
    const seat = desk && deskIso?.kipDesk ? seatTile(desk, deskIso) : null;
    const a = footOf(piece, iso);
    if (seat && seat[0] >= a.x0 && seat[0] < a.x1 && seat[1] >= a.y0 && seat[1] < a.y1) return { reason: 'seat', with: why.with };
  }
  return why;
}

export const SPOT_RADIUS = 10;

/** The target under a point in room cells (spec §5.3 Snap): a free spot within reach, else the wall, else the floor. */
export function snapTarget(g: IsoGrid, layout: RoomLayout, item: ItemId, cell: readonly [number, number], facing: 'L' | 'R', exclude: string | null): Target | null {
  const iso = isoOf(item);
  if (!iso) return null;
  const [cx, cy] = cell;
  const P = projOf(g);
  if (iso.layers.includes('onTop')) {
    let best: { t: Target; d: number } | null = null;
    for (const parent of layout.pieces) {
      const piso = isoOf(parent.item);
      if (parent.id === exclude || parent.layer === 'onTop' || !piso?.surface) continue;
      piso.surface.spots.forEach((spot, k) => {
        if (layout.pieces.some((q) => q.layer === 'onTop' && q.parent === parent.id && q.spot === k && q.id !== exclude)) return;
        const [x, y] = P(...spotPoint(parent, piso, spot));
        const d = Math.hypot(x - cx, y - cy);
        if (d <= SPOT_RADIUS && (!best || d < best.d)) best = { t: { layer: 'onTop', parent: parent.id, spot: k }, d };
      });
    }
    if (best) return (best as { t: Target }).t;
  }
  const [i, j] = unproject(g, cx, cy);
  const overFloor = i >= 0 && j >= 0;
  if (iso.layers.includes('wall') && !overFloor) {
    const right = cx >= g.ox;
    const a = Math.abs(cx - g.ox) / HT;
    const z = g.oy + a * HH - cy;
    const [along, high] = iso.wall!;
    return { layer: right ? 'wallR' : 'wallL', x: Math.round(2 * a - along / 2), y: Math.round(z / 4 - high / 2) };
  }
  if (iso.layers.includes('floor')) {
    const [w, d] = iso.foot ?? [1, 1];
    const [fw, fd] = facing === 'R' ? [d, w] : [w, d];
    return { layer: 'floor', x: Math.round(i - fw / 2), y: Math.round(j - fd / 2) };
  }
  return null;
}

/** A target's centre in room cells (for distances and for drawing the ghost there). */
export function targetPoint(g: IsoGrid, layout: RoomLayout, item: ItemId, t: Target, facing: 'L' | 'R'): [number, number] {
  const P = projOf(g);
  const iso = isoOf(item);
  if (t.layer === 'onTop') {
    const parent = layout.pieces.find((p) => p.id === t.parent);
    const piso = parent ? isoOf(parent.item) : undefined;
    const spot = piso?.surface?.spots[t.spot];
    return parent && piso && spot ? P(...spotPoint(parent, piso, spot)) : [g.W / 2, g.H / 2];
  }
  if (t.layer === 'floor') {
    const [w, d] = iso?.foot ?? [1, 1];
    const [fw, fd] = facing === 'R' ? [d, w] : [w, d];
    return P(t.x + fw / 2, t.y + fd / 2);
  }
  const [along, high] = iso?.wall ?? [1, 1];
  const a = (t.x + along / 2) / 2;
  const z = (t.y + high / 2) * 4;
  return t.layer === 'wallR' ? P(a, 0, z) : P(0, a, z);
}

/** The floor's centre in room cells: where Place looks first. */
export function roomCentre(g: IsoGrid): [number, number] {
  return projOf(g)(g.n / 2, g.m / 2);
}

function candidates(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier): Target[] {
  const iso = isoOf(item);
  if (!iso) return [];
  const out: Target[] = [];
  if (iso.layers.includes('floor')) for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) out.push({ layer: 'floor', x, y });
  if (iso.layers.includes('wall')) {
    const [along, high] = iso.wall!;
    for (const layer of ['wallL', 'wallR'] as const) {
      for (let x = 0; x + along <= wallLength(layer, tier); x++) for (let y = 0; y + high <= WALL_STEPS; y++) out.push({ layer, x, y });
    }
  }
  if (iso.layers.includes('onTop')) {
    for (const parent of layout.pieces) {
      const spots = parent.layer === 'onTop' ? undefined : isoOf(parent.item)?.surface?.spots;
      spots?.forEach((_, spot) => out.push({ layer: 'onTop', parent: parent.id, spot }));
    }
  }
  return out;
}

/** A target's stable key (drag.ts uses the same one). */
export const targetKey = (t: Target): string => (t.layer === 'onTop' ? `t:${t.parent}:${t.spot}` : `${t.layer}:${t.x}:${t.y}`);

/** Of `targets`, the free, valid one nearest `near` (ties by key), or null. */
function nearestOf(targets: Target[], g: IsoGrid, layout: RoomLayout, tier: Tier, near: readonly [number, number], base: Base): Target | null {
  const ranked = targets
    .map((t) => { const [x, y] = targetPoint(g, layout, base.item, t, base.facing); return { t, d: Math.hypot(x - near[0], y - near[1]) }; })
    .sort((a, b) => a.d - b.d || (targetKey(a.t) < targetKey(b.t) ? -1 : 1));
  for (const { t } of ranked) if (!refusal(layout, placedAt(base, t), tier, false)) return t;
  return null;
}

/** The free, valid place nearest `near` (spec §5.4 Place, §5.3 Another), or null when nothing fits. */
export function nearestFree(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier, near: readonly [number, number], base: Base): Target | null {
  return nearestOf(candidates(g, layout, item, tier), g, layout, tier, near, { ...base, item });
}

/** The free floor tile nearest `near` where the piece fits ("On the floor", spec §5.7), or null. */
export function nearestFloor(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier, near: readonly [number, number], base: Base): Target | null {
  const tiles: Target[] = [];
  for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) tiles.push({ layer: 'floor', x, y });
  return nearestOf(tiles, g, layout, tier, near, { ...base, item });
}

export interface PutOnOption { key: string; parent: string | null; spot: number; noun: string }

/**
 * Put on…: each surface with a free spot the selected piece may take, once per surface (never the spot it stands
 * on), then the floor for an on-top piece that can stand there (spec §5.7). `parent: null` is the floor.
 */
export function putOnOptions(state: Pick<EditorState, 'draft' | 'selected' | 'tier'>): PutOnOption[] {
  const layout = state.draft.layout;
  const p = layout.pieces.find((q) => q.id === state.selected);
  const iso = p ? isoOf(p.item) : undefined;
  if (!p || !iso) return [];
  const out: PutOnOption[] = [];
  if (iso.layers.includes('onTop')) {
    for (const parent of layout.pieces) {
      const spots = parent.layer === 'onTop' || parent.id === p.id ? undefined : isoOf(parent.item)?.surface?.spots;
      const free = (k: number) => !(p.parent === parent.id && p.spot === k) && !refusal(layout, placedAt(p, { layer: 'onTop', parent: parent.id, spot: k }), state.tier, false);
      const spot = spots?.findIndex((_, k) => free(k)) ?? -1;
      if (spot >= 0) out.push({ key: parent.id, parent: parent.id, spot, noun: pieceNoun(parent.item) });
    }
  }
  if (p.layer === 'onTop' && iso.layers.includes('floor')) out.push({ key: 'floor', parent: null, spot: 0, noun: 'floor' });
  return out;
}

export const COACH_ITEM = 'lamp.welcome';

/** The guided first placement's lime tile (ruling 19): (5, 3), or the free tile nearest it where the lantern fits. */
export function coachTile(g: IsoGrid, layout: RoomLayout, tier: Tier): [number, number] {
  const base = { id: '__coach', item: COACH_ITEM, facing: 'L' as const, mirror: false };
  const tiles: Array<[number, number]> = [];
  for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) tiles.push([x, y]);
  tiles.sort((a, b) => Math.abs(a[0] - 5) + Math.abs(a[1] - 3) - (Math.abs(b[0] - 5) + Math.abs(b[1] - 3)) || a[0] - b[0] || a[1] - b[1]);
  return tiles.find(([x, y]) => !refusal(layout, placedAt(base, { layer: 'floor', x, y }), tier, false)) ?? [5, 3];
}
