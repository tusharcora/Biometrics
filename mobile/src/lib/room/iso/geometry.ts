// GENERATED from backend/src/room/geometry.ts by backend/scripts/export-cosmetics.ts. Do not edit.
// KIP's free-build room (spec 2026-10-15 §2.1, §2.3, §3.2, §3.3, §12): the placement types and, from Task 2, every
// placement rule. Pure and self-contained, with no imports: backend/scripts/export-cosmetics.ts copies this file
// verbatim to mobile/src/lib/room/iso/geometry.ts and tests/room/copy.test.ts fails when the copy is stale, so the
// app's red tint and the server's 400 never disagree.

export type IsoLayer = 'floor' | 'wall' | 'onTop';

export interface IsoSpec {
  /** Where it may go; a cactus: ['floor', 'onTop']. */
  layers: IsoLayer[];
  /** Floor footprint in whole tiles, [along i, along j] facing L; facing R swaps them (plan ruling 2). */
  foot?: [number, number];
  /** Rugs: drawn under everything, never block other pieces, never overlap another rug. */
  flat?: true;
  /** Wall size: half tiles along the wall × 4-cell steps up. */
  wall?: [number, number];
  /** Things can stand on it: spots in tile fractions from the piece's origin, at height z (cells). */
  surface?: { z: number; spots: Array<[number, number]> };
  /** 2 = drawn facing L and R; 1 = Turn is off. */
  facings: 1 | 2;
  /** The desk KIP sits at (one per room). */
  kipDesk?: true;
  /** KIP's tile in the footprint, [along w, along d] facing L. */
  seat?: [number, number];
}

export type PlacementLayer = 'floor' | 'wallL' | 'wallR' | 'onTop';

export interface Placement {
  /** Made by the app: /^[a-z0-9]{1,12}$/, unique in the layout. */
  id: string;
  item: string;
  layer: PlacementLayer;
  /** floor: tile i, j of the back corner; wall: half tile along, 4-cell step up; onTop: 0, 0. */
  x: number;
  y: number;
  facing: 'L' | 'R';
  mirror: boolean;
  /** onTop only: the instance it stands on, and that piece's spot index. */
  parent?: string;
  spot?: number;
}

export const STYLE_KEYS = ['wallpaper', 'floor', 'window'] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

export interface RoomLayout {
  v: 1;
  styles: Record<StyleKey, string>;
  /** Order is not meaningful; the engine sorts. */
  pieces: Placement[];
}

/** 1 starter 7 × 7, 2 bigger 8 × 8, 3 loft 9 × 9 (spec §7). Only the expand route (P2) changes it. */
export type Tier = 1 | 2 | 3;

export const TIERS: Readonly<Record<Tier, { n: number; cap: number }>> = {
  1: { n: 7, cap: 40 },
  2: { n: 8, cap: 60 },
  3: { n: 9, cap: 90 },
};
export function tierSize(tier: Tier): { n: number; m: number } {
  const n = TIERS[tier].n;
  return { n, m: n };
}
export function capFor(tier: Tier): number {
  return TIERS[tier].cap;
}
/** A stored or sent tier: 2 and 3 as they are, anything else the starter room. */
export function toTier(n: unknown): Tier {
  return n === 2 || n === 3 ? n : 1;
}
/** Walls are 64 cells tall: 16 steps of 4. */
export const WALL_STEPS = 16;
export const INSTANCE_ID = /^[a-z0-9]{1,12}$/;
/** A shape bound well above the largest cap; the cap itself is `room_full`. */
export const MAX_LAYOUT_PIECES = 200;

/** A box on the floor (tiles) or a wall (half tiles × steps): [x0, x1) × [y0, y1). */
export interface Area { x0: number; y0: number; x1: number; y1: number }
const overlap = (a: Area, b: Area) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const covers = (a: Area, t: readonly [number, number]) => t[0] >= a.x0 && t[0] < a.x1 && t[1] >= a.y0 && t[1] < a.y1;

/** The floor tiles a piece covers from its back corner; turned, w and d swap. */
export function footOf(p: Pick<Placement, 'x' | 'y' | 'facing'>, iso: IsoSpec): Area {
  const [w, d] = iso.foot ?? [1, 1];
  const [fw, fd] = p.facing === 'R' ? [d, w] : [w, d];
  return { x0: p.x, y0: p.y, x1: p.x + fw, y1: p.y + fd };
}

export function wallAreaOf(p: Pick<Placement, 'x' | 'y'>, iso: IsoSpec): Area {
  const [a, h] = iso.wall ?? [1, 1];
  return { x0: p.x, y0: p.y, x1: p.x + a, y1: p.y + h };
}

/** A wall's length in half tiles: the left wall runs along j (m tiles), the right wall along i (n tiles). */
export function wallLength(wall: 'wallL' | 'wallR', tier: Tier): number {
  const { n, m } = tierSize(tier);
  return 2 * (wall === 'wallL' ? m : n);
}

/** The window openings (spec §3.2): the left wall's at j 1.6–3.6, and the loft's on the right wall at i n − 2.6. */
export function windowsOn(wall: 'wallL' | 'wallR', tier: Tier): Area[] {
  const span = (a0: number, a1: number): Area => ({ x0: Math.floor(2 * a0), y0: 5, x1: Math.ceil(2 * a1), y1: 14 });
  if (wall === 'wallL') return [span(1.6, 3.6)];
  const { n } = tierSize(tier);
  return tier === 3 ? [span(n - 2.6, n - 0.6)] : [];
}

/** KIP's tile at a kipDesk piece: the seat moves with the desk, turns with it, and Flip mirrors it across the width. */
export function seatTile(p: Pick<Placement, 'x' | 'y' | 'facing' | 'mirror'>, iso: IsoSpec): [number, number] | null {
  if (!iso.seat) return null;
  const [w] = iso.foot ?? [1, 1];
  const si = p.mirror ? w - 1 - iso.seat[0] : iso.seat[0];
  const sj = iso.seat[1];
  return p.facing === 'R' ? [p.x + sj, p.y + si] : [p.x + si, p.y + sj];
}

/** The tile in front of the seat, kept free so KIP can always walk out (spec §3.2, §9.2). */
export function exitTile(p: Pick<Placement, 'x' | 'y' | 'facing' | 'mirror'>, iso: IsoSpec): [number, number] | null {
  const s = seatTile(p, iso);
  if (!s) return null;
  return p.facing === 'R' ? [s[0] + 1, s[1]] : [s[0], s[1] + 1];
}

export function layerAllows(iso: IsoSpec, layer: PlacementLayer): boolean {
  return iso.layers.includes(layer === 'wallL' || layer === 'wallR' ? 'wall' : layer);
}

/** A layer the item can't use, or Turn on an item drawn one way only: `400 wrong_layer` (plan ruling 12). */
export function wrongLayer(iso: IsoSpec, p: Pick<Placement, 'layer' | 'facing'>): boolean {
  return !layerAllows(iso, p.layer) || (p.facing === 'R' && iso.facings !== 2);
}

export type BadReason = 'outside' | 'overlap' | 'wall' | 'window' | 'spot' | 'parent' | 'nested' | 'seat';
/** Why a piece can't stand where it is; `with` names the other piece involved, when there is one. */
export interface Refusal { reason: BadReason; with?: string }
export interface GeometryDeps {
  /** The item's iso block, or undefined for a style, a worn item or an id this side does not ship. */
  isoOf(item: string): IsoSpec | undefined;
}

/**
 * Why `piece` can't stand where it is in `layout`, or null. The layout's own entry with the piece's id is ignored, so
 * the same call checks a placed piece, a moved piece and a ghost from the drawer. The layer is assumed allowed
 * (validateLayout checks it first; the app checks it with layerAllows).
 */
export function checkPiece(layout: RoomLayout, piece: Placement, tier: Tier, deps: GeometryDeps): Refusal | null {
  const iso = deps.isoOf(piece.item);
  if (!iso) return { reason: 'outside' };
  const others = layout.pieces.filter((q) => q.id !== piece.id);
  const { n, m } = tierSize(tier);
  if (piece.layer === 'floor') {
    const a = footOf(piece, iso);
    if (a.x0 < 0 || a.y0 < 0 || a.x1 > n || a.y1 > m) return { reason: 'outside' };
    const exit = exitTile(piece, iso);
    if (exit && (exit[0] < 0 || exit[1] < 0 || exit[0] >= n || exit[1] >= m)) return { reason: 'seat' };
    for (const q of others) {
      if (q.layer !== 'floor') continue;
      const qi = deps.isoOf(q.item);
      if (!qi) continue;
      const b = footOf(q, qi);
      // Rugs lie under anything, never on another rug; everything else never overlaps.
      if (overlap(a, b) && !!iso.flat === !!qi.flat) return { reason: 'overlap', with: q.id };
      if (!iso.flat && !qi.flat) {
        const qExit = exitTile(q, qi);
        if ((qExit && covers(a, qExit)) || (exit && covers(b, exit))) return { reason: 'seat', with: q.id };
      }
    }
    return null;
  }
  if (piece.layer === 'wallL' || piece.layer === 'wallR') {
    const a = wallAreaOf(piece, iso);
    if (a.x0 < 0 || a.y0 < 0 || a.x1 > wallLength(piece.layer, tier) || a.y1 > WALL_STEPS) return { reason: 'outside' };
    if (windowsOn(piece.layer, tier).some((w) => overlap(a, w))) return { reason: 'window' };
    for (const q of others) {
      if (q.layer !== piece.layer) continue;
      const qi = deps.isoOf(q.item);
      if (qi && overlap(a, wallAreaOf(q, qi))) return { reason: 'wall', with: q.id };
    }
    return null;
  }
  const parent = others.find((q) => q.id === piece.parent);
  const pIso = parent ? deps.isoOf(parent.item) : undefined;
  if (!parent || !pIso) return { reason: 'parent' };
  if (parent.layer === 'onTop') return { reason: 'nested', with: parent.id };
  if (!pIso.surface) return { reason: 'parent', with: parent.id };
  const spot = piece.spot ?? -1;
  if (!Number.isInteger(spot) || spot < 0 || spot >= pIso.surface.spots.length) return { reason: 'spot', with: parent.id };
  const taken = others.find((q) => q.layer === 'onTop' && q.parent === parent.id && q.spot === spot);
  return taken ? { reason: 'spot', with: taken.id } : null;
}

/**
 * The wall pieces a size's windows cover, with what stands on them (spec §7): growing to the loft sends them to the
 * inventory, and the editor's rebase drops them from a draft. One rule for both sides (ruling PF-F4).
 */
export function coveredBy(layout: RoomLayout, tier: Tier, deps: GeometryDeps): Set<string> {
  const gone = new Set<string>();
  for (const p of layout.pieces) {
    if (p.layer !== 'wallL' && p.layer !== 'wallR') continue;
    const iso = deps.isoOf(p.item);
    const a = iso && wallAreaOf(p, iso);
    if (a && windowsOn(p.layer, tier).some((w) => overlap(a, w))) gone.add(p.id);
  }
  for (const p of layout.pieces) if (p.layer === 'onTop' && p.parent !== undefined && gone.has(p.parent)) gone.add(p.id);
  return gone;
}

/** How many of each item the layout places (owned − placed is the inventory, spec §2.2). */
export function placedCounts(layout: RoomLayout): Record<string, number> {
  const placed: Record<string, number> = {};
  for (const p of layout.pieces) placed[p.item] = (placed[p.item] ?? 0) + 1;
  return placed;
}

export type LayoutFailure =
  | { error: 'wrong_layer'; pieceIds: string[] }
  | { error: 'bad_place'; reason: BadReason; pieceIds: string[] }
  | { error: 'desk_required' }
  | { error: 'room_full'; cap: number };

/** Every rule a saved layout must meet, in the order PUT /me/cosmetics answers them (spec §12). Ids are known. */
export function validateLayout(layout: RoomLayout, tier: Tier, deps: GeometryDeps): LayoutFailure | null {
  const wrong = layout.pieces.filter((p) => {
    const iso = deps.isoOf(p.item);
    return !iso || wrongLayer(iso, p);
  });
  if (wrong.length) return { error: 'wrong_layer', pieceIds: wrong.map((p) => p.id) };
  for (const p of layout.pieces) {
    const r = checkPiece(layout, p, tier, deps);
    if (r) return { error: 'bad_place', reason: r.reason, pieceIds: r.with ? [p.id, r.with] : [p.id] };
  }
  const desks = layout.pieces.filter((p) => deps.isoOf(p.item)?.kipDesk);
  if (desks.length !== 1 || desks[0]!.layer !== 'floor') return { error: 'desk_required' };
  const cap = capFor(tier);
  return layout.pieces.length > cap ? { error: 'room_full', cap } : null;
}

const PLACEMENT_KEYS: ReadonlySet<string> = new Set(['id', 'item', 'layer', 'x', 'y', 'facing', 'mirror', 'parent', 'spot']);
const LAYERS: ReadonlySet<string> = new Set(['floor', 'wallL', 'wallR', 'onTop']);
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isItemId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** A layout's shape (400 invalid_body), or null. Ids are not looked up here. */
export function parseLayout(value: unknown): RoomLayout | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'pieces,styles,v' || v.v !== 1) return null;
  const s = v.styles as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).length !== STYLE_KEYS.length) return null;
  if (!STYLE_KEYS.every((k) => isItemId(s[k]))) return null;
  if (!Array.isArray(v.pieces) || v.pieces.length > MAX_LAYOUT_PIECES) return null;
  const ids = new Set<string>();
  const pieces: Placement[] = [];
  for (const raw of v.pieces as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const p = raw as Record<string, unknown>;
    if (Object.keys(p).some((k) => !PLACEMENT_KEYS.has(k))) return null;
    if (typeof p.id !== 'string' || !INSTANCE_ID.test(p.id) || ids.has(p.id)) return null;
    if (!isItemId(p.item) || typeof p.layer !== 'string' || !LAYERS.has(p.layer)) return null;
    if (!isInt(p.x, -64, 64) || !isInt(p.y, -64, 64) || (p.facing !== 'L' && p.facing !== 'R') || typeof p.mirror !== 'boolean') return null;
    const onTop = p.layer === 'onTop';
    if (onTop) {
      if (typeof p.parent !== 'string' || !INSTANCE_ID.test(p.parent) || !isInt(p.spot, 0, 15) || p.x !== 0 || p.y !== 0) return null;
    } else if (p.parent !== undefined || p.spot !== undefined) return null;
    ids.add(p.id);
    pieces.push({
      id: p.id, item: p.item, layer: p.layer as PlacementLayer, x: p.x, y: p.y, facing: p.facing, mirror: p.mirror,
      ...(onTop ? { parent: p.parent as string, spot: p.spot as number } : {}),
    });
  }
  return { v: 1, styles: { wallpaper: s.wallpaper as string, floor: s.floor as string, window: s.window as string }, pieces };
}
