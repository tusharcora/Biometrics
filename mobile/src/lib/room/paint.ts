// The v2 room engine's drawing helpers (docs/design/kip-coach/project/lib.js and lib2.js), typed. Every helper
// appends whole-cell rects to `r`; nothing here knows about items or KIP.
import { darkenHex, mixHex } from '../colour';
import { FLOOR_Y, ROOM_H, ROOM_W, VANISH_X, VANISH_Y, WALL_X0, WALL_X1, type RoomRect } from './grid';

export type Rects = RoomRect[];

export function R(r: Rects, x: number, y: number, w: number, h: number, c: string): void {
  if (w > 0 && h > 0) r.push([x, y, w, h, c]);
}

export function px(r: Rects, x: number, y: number, c: string): void {
  R(r, x, y, 1, 1, c);
}

/** A rect clipped to box [x, y, w, h]. */
export function Rc(r: Rects, b: readonly [number, number, number, number], x: number, y: number, w: number, h: number, c: string): void {
  const x0 = Math.max(x, b[0]), y0 = Math.max(y, b[1]), x1 = Math.min(x + w, b[0] + b[2]), y1 = Math.min(y + h, b[1] + b[3]);
  R(r, x0, y0, x1 - x0, y1 - y0, c);
}

/** A convex polygon, filled column by column. */
export function poly(r: Rects, pts: readonly (readonly [number, number])[], c: string): void {
  let minX = Infinity, maxX = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }
  for (let x = Math.round(minX); x < Math.round(maxX); x++) {
    const cx = x + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      if ((a[0] <= cx && b[0] > cx) || (b[0] <= cx && a[0] > cx)) {
        const y = a[1] + ((cx - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    }
    if (hi > lo) {
      const y0 = Math.round(lo), y1 = Math.round(hi);
      if (y1 > y0) R(r, x, y0, 1, y1 - y0, c);
    }
  }
}

/** A filled ellipse, row by row. */
export function E(r: Rects, cx: number, cy: number, rx: number, ry: number, c: string): void {
  for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) >= 1) continue;
    const hw = rx * Math.sqrt(1 - dy * dy), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    if (x1 > x0) R(r, x0, y, x1 - x0, 1, c);
  }
}

/** A soft glow: four stacked ellipses of one translucent colour. `rgb` is "r,g,b". */
export function glow(r: Rects, cx: number, cy: number, rx: number, ry: number, rgb: string, a: number): void {
  for (const k of [1, 0.78, 0.56, 0.34]) E(r, cx, cy, rx * k, ry * k, `rgba(${rgb},${a})`);
}

/** A soft contact shadow under furniture. */
export function shade(r: Rects, cx: number, cy: number, rx: number, ry: number, a = 0.16): void {
  E(r, cx, cy, rx, ry, `rgba(0,0,0,${a})`);
  E(r, cx, cy, rx * 0.72, ry * 0.62, `rgba(0,0,0,${a})`);
}

/** A vertical gradient of `cols` bands with ordered-dither seams between them. */
export function gradV(r: Rects, x: number, y: number, w: number, h: number, cols: readonly string[]): void {
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const y0 = Math.round(y + (i * h) / n), y1 = Math.round(y + ((i + 1) * h) / n);
    R(r, x, y0, w, y1 - y0, cols[i]!);
  }
  for (let i = 1; i < n; i++) {
    const yb = Math.round(y + (i * h) / n);
    for (let xx = x; xx < x + w; xx += 2) px(r, xx, yb, cols[i - 1]!);
    for (let xx = x + 1; xx < x + w; xx += 4) px(r, xx, yb + 1, cols[i - 1]!);
    for (let xx = x + 3; xx < x + w; xx += 4) px(r, xx, yb - 1, cols[i]!);
  }
}

/** Rects clipped to box b. */
export function clipB(rs: readonly RoomRect[], b: readonly [number, number, number, number]): Rects {
  const o: Rects = [];
  for (const q of rs) {
    const x0 = Math.max(q[0], b[0]), y0 = Math.max(q[1], b[1]), x1 = Math.min(q[0] + q[2], b[0] + b[2]), y1 = Math.min(q[1] + q[3], b[1] + b[3]);
    if (x1 > x0 && y1 > y0) o.push([x0, y0, x1 - x0, y1 - y0, q[4]]);
  }
  return o;
}

/** A leaf from base (bx, by) to tip (tx, ty), `w` wide at the middle, with an optional lit half. */
export function leaf(r: Rects, bx: number, by: number, tx: number, ty: number, w: number, c: string, hl?: string): void {
  const mx = (bx + tx) / 2, my = (by + ty) / 2, L = Math.hypot(tx - bx, ty - by) || 1;
  const nx = (-(ty - by) / L) * w, ny = ((tx - bx) / L) * w;
  poly(r, [[bx, by], [mx + nx, my + ny], [tx, ty], [mx - nx, my - ny]], c);
  if (hl) poly(r, [[bx, by], [mx + nx * 0.6, my + ny * 0.6], [tx, ty], [mx, my]], hl);
}

/** A tapered pot standing on yb, with a rim and a shaded right side. */
export function pot(r: Rects, cx: number, yb: number, w: number, h: number, c: string, rim?: string): void {
  poly(r, [[cx - w / 2, yb - h], [cx + w / 2, yb - h], [cx + w / 2 - 2, yb], [cx - w / 2 + 2, yb]], c);
  R(r, Math.round(cx - w / 2 - 1), yb - h - 2, w + 2, 2, rim ?? mixHex(c, '#FFFFFF', 0.2));
  poly(r, [[cx + w / 2 - 3, yb - h], [cx + w / 2, yb - h], [cx + w / 2 - 2, yb], [cx + w / 2 - 4, yb]], darkenHex(c, 0.78));
}

/** One book standing on yb, with a lit top, a shaded spine edge and two bands when tall enough. */
export function book(r: Rects, x: number, yb: number, w: number, h: number, c: string): void {
  R(r, x, yb - h, w, h, c);
  R(r, x, yb - h, w, 1, mixHex(c, '#FFFFFF', 0.28));
  R(r, x + w - 1, yb - h, 1, h, darkenHex(c, 0.72));
  if (h > 6) {
    R(r, x, yb - h + 2, w - 1, 1, mixHex(c, '#F5E6B8', 0.45));
    R(r, x, yb - 3, w - 1, 1, mixHex(c, '#F5E6B8', 0.45));
  }
}

/** A row of books from x to x1 on yb, varied by `seed`, with the odd leaning one. */
export function bookRow(r: Rects, x: number, yb: number, x1: number, cols: readonly string[], seed: number, hmax = 11): void {
  let i = 0;
  while (x < x1 - 2) {
    const w = 2 + ((seed + i * 7) % 3 === 0 ? 1 : 0), h = Math.min(hmax, hmax - 4 + ((seed + i * 5) % 5));
    if (x + w > x1) break;
    book(r, x, yb, w, h, cols[(seed + i * 3) % cols.length]!);
    x += w;
    i++;
    if ((seed + i) % 11 === 0 && x < x1 - 5) {
      poly(r, [[x, yb], [x + 2, yb], [x + 5, yb - h + 2], [x + 3, yb - h + 1]], cols[(i + 2) % cols.length]!);
      x += 5;
    }
  }
}

/** Where a back-wall x on the floor line meets the front edge, along the perspective. */
export function seamX(xb: number): number {
  return VANISH_X + ((xb - VANISH_X) * (ROOM_H - VANISH_Y)) / (FLOOR_Y - VANISH_Y);
}

/** Floor boards: perspective seams every `step` along the back wall, and cross seams at rows `ys`. */
export function floorSeams(r: Rects, step: number, c: string, ys: readonly number[] = []): void {
  for (let xb = WALL_X0 + step; xb < WALL_X1; xb += step) {
    const xf = seamX(xb);
    poly(r, [[xb, FLOOR_Y], [xb + 1, FLOOR_Y], [xf + 1, ROOM_H], [xf, ROOM_H]], c);
  }
  for (const y of ys) {
    const xl = y < FLOOR_Y + 12 ? WALL_X0 - ((y - FLOOR_Y) * WALL_X0) / 12 : 0;
    R(r, Math.round(xl), y, Math.round(ROOM_W - 2 * xl), 1, c);
  }
}

/** Ambient occlusion: the ceiling line, the wall corners, the skirting and the front edge (lib2.js `ao`). */
export function ao(r: Rects): void {
  R(r, 0, 0, ROOM_W, 2, 'rgba(0,0,0,0.22)'); R(r, 0, 2, ROOM_W, 3, 'rgba(0,0,0,0.1)');
  R(r, WALL_X0, 0, 3, FLOOR_Y, 'rgba(0,0,0,0.14)'); R(r, WALL_X0 + 3, 0, 3, FLOOR_Y, 'rgba(0,0,0,0.06)');
  R(r, WALL_X1 - 3, 0, 3, FLOOR_Y, 'rgba(0,0,0,0.14)'); R(r, WALL_X1 - 6, 0, 3, FLOOR_Y, 'rgba(0,0,0,0.06)');
  R(r, WALL_X0, FLOOR_Y - 3, WALL_X1 - WALL_X0, 3, 'rgba(0,0,0,0.08)'); R(r, WALL_X0, FLOOR_Y - 1, WALL_X1 - WALL_X0, 1, 'rgba(0,0,0,0.1)');
  R(r, WALL_X0, FLOOR_Y, WALL_X1 - WALL_X0, 2, 'rgba(0,0,0,0.16)'); R(r, WALL_X0 - 2, FLOOR_Y + 2, WALL_X1 - WALL_X0 + 4, 2, 'rgba(0,0,0,0.07)');
  poly(r, [[0, 0], [WALL_X0, 0], [WALL_X0, FLOOR_Y], [0, FLOOR_Y + 12]], 'rgba(0,0,0,0.12)');
  poly(r, [[WALL_X1, 0], [ROOM_W, 0], [ROOM_W, FLOOR_Y + 12], [WALL_X1, FLOOR_Y]], 'rgba(0,0,0,0.18)');
  R(r, 0, ROOM_H - 3, ROOM_W, 3, 'rgba(0,0,0,0.12)');
}
