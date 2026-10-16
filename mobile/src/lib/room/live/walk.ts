// KIP walking between answers (spec 2026-10-15 §9.2, C6; P3 ruling 13), pure: the tiles KIP may stand on, the use
// tile of each target (a floor piece: the free tile in front of its facing side; a wall piece: the floor tile against
// its wall under its centre; an on-top piece: its parent's), a breadth-first path on the floor grid (footprints block,
// rugs don't), the targets inside the room card's crop, and a trip: the seat, out by the desk's exit tile, to the
// target. KIP glides half a tile per 400 ms loop frame (one tile per two frames) with its depth taken from the tile it
// moves into.
import { GEOMETRY_DEPS, catalogueItem } from '../catalogue';
import type { Box } from '../grid';
import type { RoomEffects } from '../effects';
import { deskOf } from '../layout';
import { exitTile, footOf, seatTile, tierSize, type GeometryDeps, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import { isoGrid, projOf, type IsoGrid } from '../iso/grid';
import { kipTileCell, type Tile } from '../iso/movers';
import type { KipPose } from '../../kip/kipArt';

export const STEP_MS = 400;
export const USE_MS = 2400;
export const TRIP_MIN_MS = 20_000;
export const TRIP_SPAN_MS = 20_000;

export type UseKind = 'sound' | 'plant' | 'cat' | 'other';
/** What KIP does at a target (ruling 13): sways at the radio, waters a plant, waves at the cat, points at the rest. */
export const USE_POSE: Readonly<Record<UseKind, KipPose>> = { sound: 'rest', plant: 'water', cat: 'wave', other: 'point' };

export interface WalkTarget {
  id: string;
  kind: UseKind;
  /** The tile KIP stands on to use it. */
  stand: Tile;
  /** The piece's centre in room cells along x: KIP faces it. */
  x: number;
}
export interface Trip { target: WalkTarget; path: Tile[]; faceLeft: boolean }

const key = (t: Tile) => `${t[0]},${t[1]}`;

/** Every tile under a floor footprint, rugs left out. */
export function blockedTiles(layout: RoomLayout, deps: GeometryDeps = GEOMETRY_DEPS): Set<string> {
  const out = new Set<string>();
  for (const p of layout.pieces) {
    const iso = p.layer === 'floor' ? deps.isoOf(p.item) : undefined;
    if (!iso || iso.flat) continue;
    const a = footOf(p, iso);
    for (let i = a.x0; i < a.x1; i++) for (let j = a.y0; j < a.y1; j++) out.add(`${i},${j}`);
  }
  return out;
}

/** The shortest 4-neighbour path from `from` to `to` (both included) over free tiles, or null. At most 81 tiles. */
export function bfs(from: Tile, to: Tile, n: number, m: number, blocked: ReadonlySet<string>): Tile[] | null {
  const prev = new Map<string, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head]!;
    if (t[0] === to[0] && t[1] === to[1]) {
      const path: Tile[] = [];
      for (let c: Tile | null = t; c; c = prev.get(key(c)) ?? null) path.unshift(c);
      return path;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next: Tile = [t[0] + di, t[1] + dj];
      if (next[0] < 0 || next[1] < 0 || next[0] >= n || next[1] >= m || prev.has(key(next)) || blocked.has(key(next))) continue;
      prev.set(key(next), t);
      queue.push(next);
    }
  }
  return null;
}

/** Where KIP stands to use a piece (spec §9.2), or null when that tile is taken or off the floor. */
export function standTileOf(layout: RoomLayout, p: Placement, tier: Tier, blocked: ReadonlySet<string>, deps: GeometryDeps = GEOMETRY_DEPS): Tile | null {
  const { n, m } = tierSize(tier);
  const free = (t: Tile) => t[0] >= 0 && t[1] >= 0 && t[0] < n && t[1] < m && !blocked.has(key(t));
  if (p.layer === 'onTop') {
    const parent = layout.pieces.find((q) => q.id === p.parent);
    return parent ? standTileOf(layout, parent, tier, blocked, deps) : null;
  }
  const iso = deps.isoOf(p.item);
  if (!iso) return null;
  let line: Tile[];
  if (p.layer === 'floor') {
    const a = footOf(p, iso);
    line = [];
    if (p.facing === 'R') for (let j = a.y0; j < a.y1; j++) line.push([a.x1, j]);
    else for (let i = a.x0; i < a.x1; i++) line.push([i, a.y1]);
  } else {
    const [along] = iso.wall ?? [1, 1];
    const c = Math.floor((p.x + along / 2) / 2);
    line = [p.layer === 'wallR' ? [c, 0] : [0, c]];
  }
  const mid = (line.length - 1) / 2;
  const nearMiddle = line.map((t, k) => ({ t, d: Math.abs(k - mid), k })).sort((a, b) => a.d - b.d || a.k - b.k);
  return nearMiddle.find(({ t }) => free(t))?.t ?? null;
}

/** KIP standing on `tile` fits wholly inside `view` (room cells). */
export function tileInView(g: Pick<IsoGrid, 'ox' | 'oy'>, tile: Tile, view: Box): boolean {
  const [x, y] = kipTileCell(g, tile);
  return x >= view.x && y >= view.y && x + 32 <= view.x + view.w && y + 32 <= view.y + view.h;
}

const centreX = (g: IsoGrid, layout: RoomLayout, p: Placement, deps: GeometryDeps): number => {
  const P = projOf(g);
  if (p.layer === 'onTop') {
    const parent = layout.pieces.find((q) => q.id === p.parent);
    return parent ? centreX(g, layout, parent, deps) : g.W / 2;
  }
  const iso = deps.isoOf(p.item);
  if (p.layer === 'floor' && iso) { const a = footOf(p, iso); return P((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2)[0]; }
  const along = (p.x + (iso?.wall?.[0] ?? 1) / 2) / 2;
  return p.layer === 'wallR' ? P(along, 0)[0] : P(0, along)[0];
};

/** The running effect pieces and the plants KIP may walk to, standing inside `view` (spec §9.2, ruling 13). */
export function walkTargets(layout: RoomLayout, tier: Tier, effects: RoomEffects, view: Box, deps: GeometryDeps = GEOMETRY_DEPS): WalkTarget[] {
  const g = isoGrid(tier);
  const blocked = blockedTiles(layout, deps);
  const out: WalkTarget[] = [];
  for (const p of layout.pieces) {
    const effect = deps.isoOf(p.item)?.effect;
    const plant = catalogueItem(p.item)?.slot === 'plant';
    let kind: UseKind | null = null;
    if (effect && effects.running.has(p.id)) {
      if (effect === 'wander') kind = effects.states.get(p.id) === 'wander' ? null : 'cat';
      else kind = effect === 'sound' ? 'sound' : 'other';
    } else if (plant) kind = 'plant';
    if (!kind) continue;
    // A napping cat is drawn curled on its bed (ruling 10): KIP goes to the bed.
    const bedId = effects.napOn.get(p.id);
    const at = (bedId && layout.pieces.find((q) => q.id === bedId)) || p;
    const stand = standTileOf(layout, at, tier, blocked, deps);
    if (stand && tileInView(g, stand, view)) out.push({ id: p.id, kind, stand, x: centreX(g, layout, at, deps) });
  }
  return out;
}

/** One trip: a target other than the last, picked by `rng`, with a path from the seat out by the exit tile. */
export function planTrip(layout: RoomLayout, tier: Tier, effects: RoomEffects, view: Box, last: string | null, rng: () => number, deps: GeometryDeps = GEOMETRY_DEPS): Trip | null {
  const desk = deskOf(layout);
  const iso = desk ? deps.isoOf(desk.item) : undefined;
  const seat = desk && iso ? seatTile(desk, iso) : null;
  const exit = desk && iso ? exitTile(desk, iso) : null;
  if (!seat || !exit) return null;
  const { n, m } = tierSize(tier);
  const blocked = blockedTiles(layout, deps);
  const g = isoGrid(tier);
  const targets = walkTargets(layout, tier, effects, view, deps).filter((t) => t.id !== last);
  // A fair shuffle by rng, then the first target with a path.
  const order = targets.map((t) => ({ t, r: rng() })).sort((a, b) => a.r - b.r || (a.t.id < b.t.id ? -1 : 1)).map((x) => x.t);
  for (const target of order) {
    const path = bfs(exit, target.stand, n, m, blocked);
    if (!path) continue;
    const [kx] = projOf(g)(target.stand[0] + 0.5, target.stand[1] + 0.5);
    return { target, path: [seat, ...path], faceLeft: target.x < kx };
  }
  return null;
}

/** KIP's place at half step `s` (0 to 2 × (path length − 1)), moving forward (dir 1) or back (dir −1). */
export function posAt(path: readonly Tile[], s: number, dir: 1 | -1): { pos: [number, number]; depth: Tile } {
  const k = Math.floor(s / 2);
  const a = path[Math.min(k, path.length - 1)]!;
  const b = path[Math.min(k + 1, path.length - 1)]!;
  if (s % 2 === 0) return { pos: [a[0], a[1]], depth: a };
  return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], depth: dir > 0 ? b : a };
}

/** Screen x is (i − j) × 12: a step that lowers it heads left. */
export function headsLeft(from: readonly [number, number], to: readonly [number, number]): boolean {
  return to[0] - to[1] - (from[0] - from[1]) < 0;
}
