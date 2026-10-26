// KIP's room grid (spec 2026-10-14 KIP Coach §3.2, §5): 170 × 110 cells, drawn at 2 points a cell in the diorama
// and 1 in the collapsed header's thumbnail. One-point perspective: the back wall runs x 10–160 down to the floor
// line, and the side walls and floor seams converge on the vanishing point. Ported from the v2 engine
// (docs/design/kip-coach/project/lib2.js).
export const ROOM_W = 170;
export const ROOM_H = 110;
export const CELL_PT = 2;
export const FLOOR_Y = 74;
export const VANISH_X = 85;
export const VANISH_Y = 20;
export const WALL_X0 = 10;
export const WALL_X1 = 160;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One rect on the grid: x, y, w, h (cells) and a CSS colour ('#RRGGBB' or 'rgba(…)'). */
export type RoomRect = [number, number, number, number, string];

/** The window, the desk and KIP: always on screen, centred by the crop (§3.2). 280 × 200 points at 2 pt. */
export const FOCUS_BOX: Box = { x: 15, y: 10, w: 140, h: 100 };
/** KIP and the monitor: the collapsed header's thumbnail (§3.5), 96 × 60 points at 1 pt. */
export const THUMB_BOX: Box = { x: 70, y: 40, w: 96, h: 60 };

/** The smallest box holding every rect, or null for none. */
export function boundsOf(rects: readonly RoomRect[]): Box | null {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of rects) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function boxContains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}
