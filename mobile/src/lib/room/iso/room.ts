// KIP's isometric room picture (spec 2026-10-15 §3.3, §3.4, §3.6, §3.7). Pure: no React, no Skia. Order: the shell
// (walls, windows, floor), wall pieces (left wall back to front, then right), flat pieces, then floor pieces in
// topological depth order with KIP inserted at its seat tile and each piece's children right after it. Everything
// before KIP is `back`, everything after is `front` (plan ruling 8). Then the light layer (daylight through each
// window, or the night veil), the glows, and the loop frames (those behind KIP clipped by its silhouette). The same
// rects come split too, for movers (P3 ruling 11): `under` (the shell to the rugs) and one run per floor piece.
import './index';
import { catalogueItem, isoOf } from '../catalogue';
import type { Box, RoomRect } from '../grid';
import type { ItemContext, MonitorScreen, SeatStyle } from '../items';
import { effectsKey, type RoomEffects } from '../effects';
import { childrenOf, deskOf, layoutKey, pieceKey } from '../layout';
import { wornKey, type KipWorn } from '../loadout';
import { poly, R, type Rects } from '../paint';
import { DAYLIGHT, NIGHT_VEIL, type RoomWeather } from '../weather';
import { kipGrid, kipRamp, KIP_COLOURS, KIP_GRID, mirrorGrid, type KipColour, type KipMood, type KipPose } from '../../kip/kipArt';
import { pieceLayers, type IsoArtOpts } from './art';
import { deskBoxes } from './crop';
import { footOf, seatTile, type IsoSpec, type Placement, type RoomLayout, type Tier } from './geometry';
import { isoGrid, projOf, type IsoGrid, type Proj } from './grid';
import { moveRects, opaqueBounds } from './prims';
import { depthOrder, type DepthBox } from './sort';
import { drawShell, windowsFor } from './styles';

/** Room cells per KIP pixel: KIP is 32 × 32 cells, 64 × 64 points in the diorama (§4). */
export const KIP_CELLS = 2;

export interface KipSeat {
  /** Top-left of KIP's 16 × 16 grid, in room cells. */
  x: number;
  y: number;
  /** Which side of KIP the desk is on; "facing the desk" mirrors KIP when it is on the left (§4). */
  deskSide: 'left' | 'right';
  style: SeatStyle;
}

export interface RoomKip {
  colour: KipColour;
  pose: KipPose;
  mood: KipMood;
  /** What KIP wears (Spec B §7), drawn on its grid. */
  worn: KipWorn;
  /** The loop frame (0–2) for looping poses. */
  frame?: number;
  /** Default: 'desk' for `type`, 'you' otherwise (plan ruling 6). */
  facing?: 'desk' | 'you';
  /** Walking (spec §3.6): mirrored when it heads left; set, it decides the mirror on its own. */
  flip?: boolean;
}

/** KIP at its seat, 2 cells per KIP pixel, mirrored when it faces a desk on its left. */
export function drawKipLayer(kip: RoomKip, seat: KipSeat): Rects {
  const facing = kip.facing ?? (kip.pose === 'type' ? 'desk' : 'you');
  let grid = kipGrid({ colour: kip.colour, pose: kip.pose, mood: kip.mood, frame: kip.frame ?? 0, worn: kip.worn });
  if (kip.flip ?? (facing === 'desk' && seat.deskSide === 'left')) grid = mirrorGrid(grid);
  const r: Rects = [];
  for (let y = 0; y < KIP_GRID; y++) {
    let x = 0;
    const row = grid[y]!;
    while (x < KIP_GRID) {
      const c = row[x];
      if (!c) { x++; continue; }
      let w = 1;
      while (x + w < KIP_GRID && row[x + w] === c) w++;
      R(r, seat.x + x * KIP_CELLS, seat.y + y * KIP_CELLS, w * KIP_CELLS, KIP_CELLS, c);
      x += w;
    }
  }
  return r;
}

/** KIP's layer key (§5): (colour, pose, mood, worn, frame), plus facing and a walk's flip. */
export function kipLayerKey(kip: RoomKip): string {
  return `${kip.colour}#${kip.pose}#${kip.mood}#${wornKey(kip.worn)}#${kip.frame ?? 0}#${kip.facing ?? ''}#${kip.flip === undefined ? '' : kip.flip ? 'f' : 'n'}`;
}

export interface IsoStaticInput {
  layout: RoomLayout;
  tier: Tier;
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  /** A piece lifted into the drag ghost: it and its children are left out (spec §3.7). */
  hide?: string | null;
  /** Each piece's effect state (P3 ruling 7); absent, every piece draws plain (P1's room). */
  effects?: RoomEffects;
  /** Pieces drawn as movers (the wandering cat): left out of the picture, as a lifted piece is. */
  movers?: readonly string[];
}

export interface PlacedPiece { p: Placement; at: [number, number]; o: IsoArtOpts }
/** A drawn piece for hit tests: its opaque bounds and its own rects. */
export interface PieceHit { id: string; box: Box; rects: Rects }

/** One floor piece and what stands on it (and a cat napping on it), in draw order: one picture in runs mode (ruling 11). */
export interface IsoRun {
  /** The floor piece's placement id: its key in the draw order. */
  id: string;
  /** Its content: the pieces, where they are drawn, their states, the size, the light and KIP's colour. */
  key: string;
  box: DepthBox;
  rects: Rects;
}

export interface IsoStatic {
  grid: IsoGrid;
  back: Rects;
  front: Rects;
  /** The shell, the wall pieces and the rugs: everything drawn before the first floor piece. */
  under: Rects;
  /** Each floor piece with what stands on it, in the static depth order. */
  runs: IsoRun[];
  deskId: string | null;
  /** KIP's seat tile, or null with no desk. */
  seat: [number, number] | null;
  light: Rects;
  emissive: Rects;
  /** The window decor's loop frames (fairy lights, the chime): on the walls, behind KIP. */
  shellFrames: [Rects, Rects, Rects] | null;
  behind: PlacedPiece[];
  ahead: PlacedPiece[];
  /** Every drawn piece's opaque bounds, in draw order (the last one under a point is on top). */
  hits: PieceHit[];
  kipSeat: KipSeat;
  focus: Box;
  thumb: Box;
}

const KIP_KEY = '@kip';

/** The room point of a spot on a parent (spec §3.3): [i, j, z]. Flip mirrors a floor parent's spots across its width. */
export function spotPoint(parent: Placement, piso: IsoSpec, spot: readonly [number, number]): [number, number, number] {
  const z = piso.surface!.z;
  const [si, sj] = spot;
  if (parent.layer === 'wallR') return [parent.x / 2 + si, sj, parent.y * 4 + z];
  if (parent.layer === 'wallL') return [sj, parent.x / 2 + si, parent.y * 4 + z];
  const [w] = piso.foot ?? [1, 1];
  const a = parent.mirror ? w - si : si;
  return parent.facing === 'R' ? [parent.x + sj, parent.y + a, z] : [parent.x + a, parent.y + sj, z];
}

/** Where a piece's own space starts in room cells (Task 7's piece space), or null when it can't stand. */
export function anchorOf(P: Proj, p: Placement, byId: ReadonlyMap<string, Placement>): [number, number] | null {
  if (p.layer === 'floor') return P(p.x, p.y, 0);
  if (p.layer === 'wallR') return P(p.x / 2, 0, p.y * 4);
  if (p.layer === 'wallL') return P(0, p.x / 2, p.y * 4);
  const parent = byId.get(p.parent ?? '');
  const piso = parent ? isoOf(parent.item) : undefined;
  const spot = piso?.surface?.spots[p.spot ?? -1];
  if (!parent || !piso || !spot) return null;
  const [x, y] = P(...spotPoint(parent, piso, spot));
  return [Math.round(x), Math.round(y)];
}

/** KIP on the desk's seat tile (spec §3.6): its 32-cell grid stands on the tile centre. No desk: the room's centre. */
export function kipAt(g: IsoGrid, layout: RoomLayout): KipSeat {
  const P = projOf(g);
  const desk = deskOf(layout);
  const iso = desk ? isoOf(desk.item) : undefined;
  const seat = desk && iso ? seatTile(desk, iso) : null;
  const [si, sj] = seat ?? [Math.floor(g.n / 2), Math.floor(g.m / 2)];
  const [cx, cy] = P(si + 0.5, sj + 0.5);
  return {
    x: Math.round(cx) - 8 * KIP_CELLS,
    y: Math.round(cy) - 15 * KIP_CELLS,
    deskSide: desk?.facing === 'R' ? 'left' : 'right',
    style: catalogueItem(desk?.item)?.style ?? 'standard',
  };
}

function daylightIn(r: Rects, P: Proj, g: IsoGrid, tier: Tier, weather: RoomWeather): void {
  const a = DAYLIGHT[weather];
  for (const w of windowsFor(g, tier)) {
    const pool = (o: number, dz: number, far: number) =>
      w.wall === 'wallL'
        ? [P(0, w.a0 + o), P(0, w.a0 + w.da - o), P(far, w.a0 + w.da + dz), P(far, w.a0 + 1.6 - o)]
        : [P(w.a0 + o, 0), P(w.a0 + w.da - o, 0), P(w.a0 + w.da + dz, far), P(w.a0 + 1.6 - o, far)];
    poly(r, pool(0, 1.6, 3.4), `rgba(255,241,210,${a})`);
    poly(r, pool(0.3, 1.0, 2.4), `rgba(255,241,210,${(a * 0.6).toFixed(3)})`);
  }
}

export function drawIsoStatic(input: IsoStaticInput): IsoStatic {
  const { layout, tier, night, weather, colour } = input;
  const g = isoGrid(tier);
  const P = projOf(g);
  const ctx: ItemContext = { weather, night, colour, ramp: kipRamp(KIP_COLOURS[colour]), screen: 'lines' };
  const shell = drawShell(g, tier, layout.styles, ctx);
  const back: Rects = [...(shell.base ?? [])];
  const front: Rects = [];
  const emissive: Rects = [...(shell.emissive ?? [])];
  const behind: PlacedPiece[] = [];
  const ahead: PlacedPiece[] = [];
  const hits: PieceHit[] = [];
  const hide = input.hide ?? null;
  const away = new Set([...(input.movers ?? []), ...(hide ? [hide] : [])]);
  const visible = layout.pieces.filter((p) => isoOf(p.item) && !away.has(p.id) && !(p.layer === 'onTop' && away.has(p.parent ?? '')));
  const visibleLayout = { ...layout, pieces: visible };
  const byId = new Map(visible.map((p) => [p.id, p]));
  // A napping cat lies on its bed (spec §8.2): drawn right after the bed, at the bed's corner, with the bed's depth.
  const napOn = input.effects?.napOn ?? new Map<string, string>();
  const catOnBed = new Map([...napOn].filter(([cat, bed]) => byId.has(cat) && byId.has(bed)).map(([cat, bed]) => [bed, cat]));
  const napping = new Set(catOnBed.values());
  let target = back;
  let list = behind;
  let run: IsoRun | null = null;
  const put = (p: Placement, at0?: [number, number]) => {
    const at = at0 ?? anchorOf(P, p, byId);
    const state = input.effects?.states.get(p.id);
    const o: IsoArtOpts = { layer: p.layer, facing: p.facing, mirror: p.mirror, ...(state ? { effect: state } : {}) };
    const l = at ? pieceLayers(p.item, ctx, o) : null;
    if (!at || !l) return;
    const base = moveRects(l.base ?? [], at[0], at[1]);
    target.push(...base);
    if (run) run.rects.push(...base);
    if (l.emissive) emissive.push(...moveRects(l.emissive, at[0], at[1]));
    list.push({ p, at, o });
    const b = opaqueBounds(base);
    if (b) hits.push({ id: p.id, box: b, rects: base });
    for (const c of childrenOf(visibleLayout, p.id)) put(c);
    const cat = catOnBed.get(p.id);
    if (cat) put(byId.get(cat)!, at);
  };
  const byPos = (a: Placement, b: Placement) => a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const wall of ['wallL', 'wallR'] as const) visible.filter((p) => p.layer === wall).sort(byPos).forEach((p) => put(p));
  const floor = visible.filter((p) => p.layer === 'floor' && !napping.has(p.id));
  floor.filter((p) => isoOf(p.item)!.flat).sort((a, b) => a.x + a.y - (b.x + b.y) || byPos(a, b)).forEach((p) => put(p));
  const under: Rects = [...back];
  const solid = floor.filter((p) => !isoOf(p.item)!.flat);
  const boxes: DepthBox[] = solid.map((p) => { const a = footOf(p, isoOf(p.item)!); return { key: p.id, i0: a.x0, j0: a.y0, i1: a.x1, j1: a.y1 }; });
  const kipSeat = kipAt(g, layout);
  const desk = deskOf(layout);
  const seat = desk ? seatTile(desk, isoOf(desk.item)!) : null;
  if (seat) boxes.push({ key: KIP_KEY, i0: seat[0], j0: seat[1], i1: seat[0] + 1, j1: seat[1] + 1 });
  const order = depthOrder(boxes, desk && byId.has(desk.id) ? [[desk.id, KIP_KEY]] : []);
  if (!seat) { target = front; list = ahead; }
  // Each floor piece's run: its rects and those of what it carries, keyed by what they are and where (ruling 11).
  const runs: IsoRun[] = [];
  const boxOf = new Map(boxes.map((b) => [b.key, b]));
  for (const key of order) {
    if (key === KIP_KEY) { target = front; list = ahead; continue; }
    const p = byId.get(key)!;
    run = { id: p.id, key: '', box: boxOf.get(key)!, rects: [] };
    const from = list.length;
    put(p);
    const placed = list.slice(from).map((pp) => `${pieceKey(pp.p)}@${pp.at.join(',')}~${pp.o.effect ?? ''}`).join(';');
    run.key = `${tier}#${night ? 'n' : 'd'}#${colour}#${weather}#${placed}`;
    runs.push(run);
    run = null;
  }
  const light: Rects = [];
  if (night) R(light, 0, 0, g.W, g.H, NIGHT_VEIL);
  else daylightIn(light, P, g, tier, weather);
  const { focus, thumb } = deskBoxes(g, layout);
  const deskId = desk && byId.has(desk.id) ? desk.id : null;
  return { grid: g, back, front, under, runs, deskId, seat, light, emissive, shellFrames: shell.frames ?? null, behind, ahead, hits, kipSeat, focus, thumb };
}

/** Removes from `rects` every cell KIP's rects cover (a loop behind KIP never paints over it, ruling 8). */
export function clipOut(rects: readonly RoomRect[], kip: readonly RoomRect[]): Rects {
  const mask = new Set<string>();
  for (const [x, y, w, h] of kip) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) mask.add(`${x + i},${y + j}`);
  const out: Rects = [];
  for (const [x, y, w, h, c] of rects) {
    for (let row = y; row < y + h; row++) {
      let u = x;
      while (u < x + w) {
        if (mask.has(`${u},${row}`)) { u++; continue; }
        let v = u + 1;
        while (v < x + w && !mask.has(`${v},${row}`)) v++;
        out.push([u, row, v - u, 1, c]);
        u = v;
      }
    }
  }
  return out;
}

/**
 * The three loop frames for a screen state: the shell's and those behind KIP, each clipped by KIP's silhouette in that
 * same frame (ruling T10-FIX), then those in front. All three come out together, so the caller records them once per
 * (static picture, screen, KIP's pose) and the 400 ms tick only picks one, never re-recording them.
 */
export function drawIsoFramesEach(
  s: IsoStatic,
  c: { night: boolean; colour: KipColour; screen: MonitorScreen },
  kips: readonly [Rects, Rects, Rects],
): [Rects, Rects, Rects] {
  const ctx: ItemContext = { weather: 'clear', night: c.night, colour: c.colour, ramp: kipRamp(KIP_COLOURS[c.colour]), screen: c.screen };
  const out: [Rects, Rects, Rects] = [[], [], []];
  const add = (frames: readonly Rects[] | undefined, dx: number, dy: number, clip: boolean) => {
    frames?.forEach((f, k) => { const m = moveRects(f, dx, dy); out[k as 0 | 1 | 2].push(...(clip ? clipOut(m, kips[k as 0 | 1 | 2]) : m)); });
  };
  add(s.shellFrames ?? undefined, 0, 0, true);
  for (const pp of s.behind) add(pieceLayers(pp.p.item, ctx, pp.o)?.frames, pp.at[0], pp.at[1], true);
  for (const pp of s.ahead) add(pieceLayers(pp.p.item, ctx, pp.o)?.frames, pp.at[0], pp.at[1], false);
  return out;
}

/**
 * The static picture's memo key: the layout's content, the tier, the light, KIP's colour, the lifted piece, the
 * pieces' effect states (P3 ruling 7) and the pieces drawn as movers (ruling 11).
 */
export function isoRoomKey(input: IsoStaticInput): string {
  const effects = input.effects ? effectsKey(input.effects) : '';
  return `${layoutKey(input.layout)}#${input.tier}#${input.weather}#${input.night ? 'n' : 'd'}#${input.colour}#${input.hide ?? ''}#${effects}#${[...(input.movers ?? [])].sort().join(',')}`;
}

/** The topmost piece with an opaque cell at room cell (x, y), or null (its shadow and glows don't count). */
export function pieceAt(hits: readonly PieceHit[], x: number, y: number): string | null {
  const inside = (b: { x: number; y: number; w: number; h: number }) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  for (let k = hits.length - 1; k >= 0; k--) {
    const { id, box, rects } = hits[k]!;
    if (inside(box) && rects.some(([rx, ry, w, h, c]) => !c.startsWith('rgba') && inside({ x: rx, y: ry, w, h }))) return id;
  }
  return null;
}
