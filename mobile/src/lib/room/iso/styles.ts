// The room's shell and its three room-wide styles (spec 2026-10-15 §1, §3.2, §4; isox.py `shell`, `win`). Walls:
// the wallpaper's front-on back-wall band, sheared onto both walls (the left one darker, as the window lights the
// right one). Floor: five iso floors in the boards' colours. Windows: today's sky (Spec A's windowSky) sheared onto
// the wall, the style's frame colour and its decor scaled onto the iso frame (plan rulings 5 and 6).
import { FLOOR_Y, WALL_X0, WALL_X1, type RoomRect } from '../grid';
import { itemArt, type ItemContext, type ItemLayers } from '../items';
import type { ItemId } from '../loadout';
import { clipB, poly, px, type Rects } from '../paint';
import { windowSky } from '../weather';
import { WINDOW_DECOR, WINDOW_O } from '../items/window';
import { cottageWindowDecor } from '../items/sets/cottage';
import type { StyleKey, Tier } from './geometry';
import { HT, HH, WALL_H, projOf, type IsoGrid, type Proj } from './grid';
import { dark, flat, lite, line, moveRects, scaleRects, shear } from './prims';

/** The wallpaper rows used: the 62 above Spec A's 2-row skirting (the iso skirting covers the last 3). */
export const WALL_TEXTURE_ROWS = 62;

/** A wallpaper as a texture: its front-on back-wall band, x from the back wall's left edge, y up from the floor line. */
export function wallTexture(id: ItemId, ctx: ItemContext): Rects {
  const art = itemArt(id)?.slot === 'wallpaper' ? itemArt(id)! : itemArt('wall.plain')!;
  const band = clipB(art.draw(ctx).base ?? [], [WALL_X0, FLOOR_Y - WALL_H, WALL_X1 - WALL_X0, WALL_TEXTURE_ROWS]);
  return moveRects(band, -WALL_X0, -FLOOR_Y);
}

function drawWalls(r: Rects, g: IsoGrid, P: Proj, id: ItemId, ctx: ItemContext): void {
  const tex = wallTexture(id, ctx);
  // The right wall (j = 0): its texture starts at the back corner and runs down-right.
  r.push(...shear(clipB(tex, [0, -WALL_H, g.n * HT, WALL_H]), g.ox, g.oy, 1));
  // The left wall (i = 0): its screen-left end is the front left corner, rising to the back corner.
  r.push(...shear(clipB(tex, [0, -WALL_H, g.m * HT, WALL_H]), g.ox - g.m * HT, g.oy + g.m * HH, -1));
  poly(r, [P(0, 0, 0), P(0, g.m, 0), P(0, g.m, WALL_H), P(0, 0, WALL_H)], 'rgba(0,0,0,0.14)');
  line(r, P(0, g.m, WALL_H), P(0, 0, WALL_H), 'rgba(255,255,255,0.14)');
  line(r, P(0, 0, WALL_H), P(g.n, 0, WALL_H), 'rgba(255,255,255,0.14)');
  poly(r, [P(0, 0, 0), P(0, g.m, 0), P(0, g.m, 3), P(0, 0, 3)], 'rgba(0,0,0,0.38)');
  poly(r, [P(0, 0, 0), P(g.n, 0, 0), P(g.n, 0, 3), P(0, 0, 3)], 'rgba(0,0,0,0.3)');
}

type FloorStyle = (r: Rects, g: IsoGrid, P: Proj, ctx: ItemContext) => void;

const tiles = (r: Rects, g: IsoGrid, P: Proj, a: string, b: string) => {
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.m; j++) flat(r, P, i, j, 1, 1, (i + j) % 2 ? b : a);
};
const planks = (r: Rects, g: IsoGrid, P: Proj, c: string) => {
  for (let j = 0; j < g.m; j++) line(r, P(0, j + 0.5), P(g.n, j + 0.5), c);
};
const seams = (r: Rects, g: IsoGrid, P: Proj, c: string, every = 1) => {
  for (let i = every; i < g.n; i += every) line(r, P(i, 0), P(i, g.m), c);
  for (let j = every; j < g.m; j += every) line(r, P(0, j), P(g.n, j), c);
};
/** Speckles stepping through the floor in tenths of a tile, with the board's steps (Spec B Task 9 minor). */
const speckle = (r: Rects, g: IsoGrid, P: Proj, n: number, a: string, b: string, si: number, sj: number, oi: number, oj: number) => {
  for (let k = 0; k < n; k++) {
    const [x, y] = P(((k * si + oi) % (g.n * 10)) / 10 + 0.05, ((k * sj + oj) % (g.m * 10)) / 10 + 0.05);
    px(r, Math.round(x), Math.round(y), k % 2 ? a : b);
  }
};

export const FLOOR_STYLES: Readonly<Record<ItemId, FloorStyle>> = {
  'floor.oakDark': (r, g, P) => { tiles(r, g, P, '#4A382B', '#523E2F'); planks(r, g, P, dark('#4A382B', 0.12)); },
  'floor.tiles': (r, g, P) => { tiles(r, g, P, '#E5E7EB', '#DDE1E6'); seams(r, g, P, '#CBD5E1'); },
  'floor.carpet': (r, g, P, { ramp }) => { tiles(r, g, P, ramp.shade, ramp.shade); speckle(r, g, P, g.n * g.m * 24, ramp.deep, ramp.body, 5, 3, 1, 2); },
  'floor.concrete': (r, g, P) => { tiles(r, g, P, '#57534E', '#5A5650'); speckle(r, g, P, g.n * g.m * 16, '#48443F', '#6B665F', 7, 11, 3, 5); seams(r, g, P, '#4A4642', 2); },
  'set.cottage.floor': (r, g, P) => { tiles(r, g, P, '#C19A6B', '#BB9465'); planks(r, g, P, '#A57F52'); },
};
const FLOOR_EDGE: Readonly<Record<ItemId, string>> = {
  'floor.oakDark': '#4A382B', 'floor.tiles': '#B8BEC8', 'floor.concrete': '#57534E', 'set.cottage.floor': '#A57F52',
};

export interface WindowStyle {
  frame: string;
  mullion: string;
  /** Decor in front-on cells; the board's window frame (34 × 30) sits at WINDOW_O. */
  decor: (ctx: ItemContext) => ItemLayers;
}
export const WINDOW_STYLES: Readonly<Record<ItemId, WindowStyle>> = {
  ...Object.fromEntries(Object.entries(WINDOW_DECOR).map(([id, decor]) => [id, { frame: '#1E2430', mullion: '#1E2430', decor }])),
  'set.cottage.window': { frame: '#F5F1E6', mullion: '#F5F1E6', decor: () => { const r: Rects = []; cottageWindowDecor(r); return { base: r }; } },
};

export interface IsoWindow { wall: 'wallL' | 'wallR'; a0: number; da: number }
/** The left wall's window (j 1.6–3.6) and, in the loft, the right wall's at i = n − 2.6 (spec §3.2). */
export function windowsFor(g: IsoGrid, tier: Tier): IsoWindow[] {
  return [{ wall: 'wallL', a0: 1.6, da: 2 }, ...(tier === 3 ? [{ wall: 'wallR' as const, a0: g.n - 2.6, da: 2 }] : [])];
}

/** The iso window frame: 24 cells across (2 tiles), 34 up (z 22–56); the glass inside at z 24–54. */
const FRAME_W = 24;
const FRAME_H = 34;
const BOARD_W = 34;
const BOARD_H = 30;

function drawWindow(out: Required<Pick<ItemLayers, 'base' | 'emissive'>> & { frames: Rects[] | null }, g: IsoGrid, P: Proj, w: IsoWindow, style: WindowStyle, ctx: ItemContext): void {
  const left = w.wall === 'wallL';
  // The plane's origin: the frame's screen-left end at z 22 (the far end on the left wall, the near end on the right),
  // rounded to a whole cell (P(0, 3.6, 22) is (42.8, 67.6)).
  const [ox, oy] = (left ? P(0, w.a0 + w.da, 22) : P(w.a0, 0, 22)).map(Math.round) as [number, number];
  const onWall = (rects: Rects) => shear(rects, ox, oy, left ? -1 : 1);
  const plane: Rects = [[0, -FRAME_H, FRAME_W, FRAME_H, style.frame]];
  windowSky(plane, { x: 1, y: -FRAME_H + 2, w: FRAME_W - 2, h: 30 }, ctx.weather, ctx.night);
  plane.push([FRAME_W / 2 - 1, -FRAME_H + 2, 2, 30, style.mullion], [1, -17, FRAME_W - 2, 1, style.mullion]);
  out.base.push(...onWall(plane));
  // The sill stands out of the wall on the floor plane (isox.py).
  const sill = left
    ? [P(0, w.a0 - 0.1, 22), P(0, w.a0 + w.da + 0.1, 22), P(0.25, w.a0 + w.da + 0.1, 22), P(0.25, w.a0 - 0.1, 22)]
    : [P(w.a0 - 0.1, 0, 22), P(w.a0 + w.da + 0.1, 0, 22), P(w.a0 + w.da + 0.1, 0.25, 22), P(w.a0 - 0.1, 0.25, 22)];
  poly(out.base, sill, lite('#2F3646', 0.1));
  // The style's decor, from board-frame cells onto the iso frame.
  const map = (rects: readonly RoomRect[] | undefined) =>
    onWall(moveRects(scaleRects(moveRects(rects ?? [], -WINDOW_O[0], -WINDOW_O[1]), FRAME_W / BOARD_W, FRAME_H / BOARD_H), 0, -FRAME_H));
  const d = style.decor(ctx);
  out.base.push(...map(d.base));
  out.emissive.push(...map(d.emissive));
  if (d.frames) {
    const f = d.frames.map((fr) => map(fr));
    out.frames = out.frames ? out.frames.map((prev, k) => [...prev, ...f[k]!]) : f;
  }
}

/** The walls, windows and floor for a tier and three styles; unknown ids draw as the starter styles. */
export function drawShell(g: IsoGrid, tier: Tier, styles: Record<StyleKey, ItemId>, ctx: ItemContext): ItemLayers {
  const P = projOf(g);
  const out = { base: [] as Rects, emissive: [] as Rects, frames: null as Rects[] | null };
  drawWalls(out.base, g, P, styles.wallpaper, ctx);
  const win = WINDOW_STYLES[styles.window] ?? WINDOW_STYLES['win.plain']!;
  for (const w of windowsFor(g, tier)) drawWindow(out, g, P, w, win, ctx);
  const floorId = FLOOR_STYLES[styles.floor] ? styles.floor : 'floor.oakDark';
  FLOOR_STYLES[floorId]!(out.base, g, P, ctx);
  const edge = FLOOR_EDGE[floorId] ?? ctx.ramp.deep;
  poly(out.base, [P(g.n, 0, 0), P(g.n, g.m, 0), P(g.n, g.m, -5), P(g.n, 0, -5)], dark(edge, 0.42));
  poly(out.base, [P(0, g.m, 0), P(g.n, g.m, 0), P(g.n, g.m, -5), P(0, g.m, -5)], dark(edge, 0.3));
  return { base: out.base, emissive: out.emissive, ...(out.frames ? { frames: out.frames as [Rects, Rects, Rects] } : {}) };
}
