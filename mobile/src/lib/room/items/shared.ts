// The v2 art helpers every item file shares (spec 2026-10-14 KIP's room §8; docs/design/kip-coach/project/lib2.js).
// Items are drawn on the 170 × 110 room grid at the engine's slot anchors (slots.ts), from the Cat boards' sprites
// (one board pixel = one room cell) with the v2 finish: contact shadows, a lit edge, glows in the emissive layer.
import { darkenHex, mixHex } from '../../colour';
import type { KipRamp } from '../../kip/kipArt';
import { tintOf } from '../../kip/wornArt';
import { FLOOR_Y, ROOM_H, ROOM_W, WALL_X0, WALL_X1, type Box, type RoomRect } from '../grid';
import type { SpriteRect } from '../icons';
import type { ItemArt, ItemContext } from '../items';
import type { ItemId } from '../loadout';
import type { RoomSlot } from '../slots';
import { clipB, poly, R, shade, type Rects } from '../paint';
import { NIGHT_VEIL_ALPHA, NIGHT_VEIL_RGB, windowSky } from '../weather';

export type { SpriteRect } from '../icons';

/** A board sprite placed with its own (0, 0) at (x, y). */
export function sprite(r: Rects, rects: readonly SpriteRect[], x: number, y: number, ramp: KipRamp): void {
  for (const [sx, sy, w, h, c] of rects) R(r, x + sx, y + sy, w, h, tintOf(c, ramp));
}

export function spriteBox(rects: readonly SpriteRect[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of rects) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A three-frame loop from one frame function. */
export const three = (f: (k: 0 | 1 | 2) => Rects): [Rects, Rects, Rects] => [f(0), f(1), f(2)];

/** A readable accent on dark glass: ink and slate are too dark, so they show as off-white (lib.js accentOf). */
export const accentOn = (body: string): string => {
  const n = parseInt(body.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.42 ? '#F5F5F4' : body;
};

/**
 * A loop-frame colour as the night veil leaves it. Loop frames draw above the light layer, so a piece that is not lit
 * (a swinging bag, falling flakes, steam) dims its own frames at night; screens and glows stay as they are.
 * Takes '#RRGGBB' or 'rgba(r,g,b,a)' (the alpha is kept).
 */
export function veiled(c: string, night: boolean): string {
  if (!night) return c;
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c);
  if (!m) return mixHex(c, NIGHT_VEIL_RGB, NIGHT_VEIL_ALPHA);
  const hex = '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  return `rgba(${rgbOf(mixHex(hex, NIGHT_VEIL_RGB, NIGHT_VEIL_ALPHA))},${m[4]})`;
}

/** '#FDE047' → '253,224,71', for glow(). */
export function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** The back wall, as a clip box. */
export const BACK_WALL: readonly [number, number, number, number] = [WALL_X0, 0, WALL_X1 - WALL_X0, FLOOR_Y];

/** A wallpaper: the pattern over the back wall, plain side walls in `side`, and the skirting (as Plain slate). */
export function wallSurface(r: Rects, base: string, side: string, pattern: (p: Rects, x: number, y: number, w: number, h: number) => void): void {
  R(r, BACK_WALL[0], BACK_WALL[1], BACK_WALL[2], BACK_WALL[3], base);
  const p: Rects = [];
  pattern(p, BACK_WALL[0], BACK_WALL[1], BACK_WALL[2], BACK_WALL[3]);
  r.push(...clipB(p, BACK_WALL));
  poly(r, [[0, 0], [WALL_X0, 0], [WALL_X0, FLOOR_Y], [0, FLOOR_Y + 12]], side);
  poly(r, [[WALL_X1, 0], [ROOM_W, 0], [ROOM_W, FLOOR_Y + 12], [WALL_X1, FLOOR_Y]], side);
  R(r, WALL_X0, FLOOR_Y - 2, WALL_X1 - WALL_X0, 2, darkenHex(base, 0.7));
}

export const FLOOR_POLY: ReadonlyArray<readonly [number, number]> = [
  [WALL_X0, FLOOR_Y], [WALL_X1, FLOOR_Y], [ROOM_W, FLOOR_Y + 12], [ROOM_W, ROOM_H], [0, ROOM_H], [0, FLOOR_Y + 12],
];

/** The floor's span [x0, x1) at row y: the trapezoid under the back wall, then the full grid. */
export function floorSpan(y: number): [number, number] {
  if (y < FLOOR_Y) return [0, 0];
  if (y >= FLOOR_Y + 12) return [0, ROOM_W];
  const xl = WALL_X0 - ((y - FLOOR_Y) * WALL_X0) / 12;
  return [Math.ceil(xl), Math.floor(ROOM_W - xl)];
}

/** Rects clipped to the floor, row by row. */
export function clipFloor(rects: readonly RoomRect[]): Rects {
  const out: Rects = [];
  for (const [x, y, w, h, c] of rects) {
    for (let row = Math.max(y, FLOOR_Y); row < Math.min(y + h, ROOM_H); row++) {
      const [x0, x1] = floorSpan(row);
      const a = Math.max(x, x0), b = Math.min(x + w, x1);
      if (b > a) out.push([a, row, b - a, 1, c]);
    }
  }
  return out;
}

/** A floor: its base colour on the floor polygon, then the pattern clipped to it. */
export function floorSurface(r: Rects, base: string, pattern: (p: Rects) => void): void {
  poly(r, FLOOR_POLY, base);
  const p: Rects = [];
  pattern(p);
  r.push(...clipFloor(p));
}

/** Art hangs centred in its anchor, below a 2-cell pin, with a soft shadow on the wall. */
export function artFrame(r: Rects, rects: readonly SpriteRect[], ramp: KipRamp, anchor: Box): void {
  const b = spriteBox(rects);
  const x = anchor.x + Math.floor((anchor.w - b.w) / 2) - b.x;
  const y = anchor.y + 3 - b.y;
  R(r, x + b.x + 1, y + b.y + 1, b.w, b.h, 'rgba(0,0,0,0.18)');
  R(r, x + b.x + Math.floor(b.w / 2) - 1, anchor.y, 2, 2, '#94A3B8');
  sprite(r, rects, x, y, ramp);
}

/** Spec A's plain window (starterItems `win.plain`): frame, sky and sill. Every window piece draws it first. */
export function windowFrame(r: Rects, { weather, night }: Pick<ItemContext, 'weather' | 'night'>): void {
  R(r, 18, 12, 36, 40, '#1E2430');
  windowSky(r, { x: 20, y: 14, w: 32, h: 36 }, weather, night);
  R(r, 35, 14, 2, 36, '#1E2430');
  R(r, 20, 31, 32, 1, '#1E2430');
  R(r, 16, 52, 40, 3, '#191E28');
  R(r, 16, 52, 40, 1, '#2A3140');
}

/** Spec A's shelf plank (starterItems `shelf.books`). Every shelf piece stands on it. */
export const SHELF_TOP = 30;
export function shelfPlank(r: Rects): void {
  R(r, 96, SHELF_TOP, 34, 2, '#5B4636');
  R(r, 96, SHELF_TOP, 34, 1, '#7C5A3E');
  R(r, 99, SHELF_TOP + 2, 1, 2, '#3A2D23');
  R(r, 126, SHELF_TOP + 2, 1, 2, '#3A2D23');
}

const WOOD = { leg: '#7C5A3E', top: '#9A7350' };
const CHAIR = '#3F4656';

/** Spec A's desk (sets2.js `desk`) and KIP's chair, back on the right (starterItems `desk.monitor`). Every desk
 *  piece draws it first, then what stands on it (the desk top is y 72). */
export function deskFurniture(r: Rects): void {
  // The desk.
  shade(r, 88, 99, 30, 3, 0.12);
  R(r, 64, 75, 3, 24, darkenHex(WOOD.leg, 0.85));
  R(r, 109, 75, 3, 24, darkenHex(WOOD.leg, 0.85));
  R(r, 62, 72, 52, 3, WOOD.top);
  R(r, 62, 72, 52, 1, mixHex(WOOD.top, '#FFFFFF', 0.22));
  R(r, 62, 75, 52, 2, WOOD.leg);
  // KIP's chair, back on the right.
  shade(r, 123, 96, 18, 2);
  R(r, 136, 58, 3, 29, CHAIR);
  R(r, 138, 58, 1, 29, mixHex(CHAIR, '#FFFFFF', 0.15));
  R(r, 108, 84, 31, 3, CHAIR);
  R(r, 108, 84, 31, 1, mixHex(CHAIR, '#FFFFFF', 0.15));
  R(r, 110, 87, 2, 9, darkenHex(CHAIR, 0.8));
  R(r, 134, 87, 2, 9, darkenHex(CHAIR, 0.8));
}

/** A board sprite standing on row `footY`, on a soft contact shadow as wide as the sprite (floor and desk pieces). */
export function standing(r: Rects, rects: readonly SpriteRect[], x: number, y: number, footY: number, ramp: KipRamp): void {
  const b = spriteBox(rects);
  shade(r, x + b.x + b.w / 2, footY, b.w / 2 + 1, 1, 0.16);
  sprite(r, rects, x, y, ramp);
}

/** A piece that is one board sprite standing on row `footY` (desk items, plants, corner pieces, the pet bed). */
export function standingPiece(id: ItemId, slot: RoomSlot, rects: readonly SpriteRect[], x: number, y: number, footY: number, tint?: true): ItemArt {
  return {
    id, slot, ...(tint ? { tint } : {}),
    draw: ({ ramp }) => {
      const r: Rects = [];
      standing(r, rects, x, y, footY, ramp);
      return { base: r };
    },
  };
}

/** Items allowed to draw outside their slot's anchor, and why (ruling 3). */
export const ANCHOR_EXEMPT: ReadonlyMap<ItemId, string> = new Map([
  ['set.cottage.lamp', 'fairy lights strung along the ceiling beam, across the whole back wall'],
]);

export { mixHex, darkenHex, tintOf };
