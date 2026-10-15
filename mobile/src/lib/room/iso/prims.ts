// iso.py's drawing primitives, typed (spec 2026-10-15 §3.7, §4): boxes with the window-side light (left faces
// lighter, right faces darker), flat floor shapes, 2:1 stair-step lines, sprites sheared onto a wall. Every helper
// appends whole-cell rects; nothing here knows about items.
import { mixHex } from '../../colour';
import type { Box, RoomRect } from '../grid';
import { R, poly, shade, type Rects } from '../paint';
import { HH, HT, type Proj } from './grid';

export const dark = (c: string, t = 0.25): string => mixHex(c, '#000000', t);
export const lite = (c: string, t = 0.2): string => mixHex(c, '#FFFFFF', t);

type Pt = readonly [number, number];

/** iso.py `line`: one cell per column, so a 2:1 diagonal is a stair (never a smoothed line). */
export function line(r: Rects, a: Pt, b: Pt, c: string): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const n = Math.max(Math.trunc(Math.abs(x1 - x0)), 1);
  for (let k = 0; k < n; k++) {
    const t = k / n;
    R(r, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t), 1, 1, c);
  }
}

/** iso.py `box`: the j-max face (toward the lower left, lit), the i-max face (shaded), the top and its lit edge. */
export function box(r: Rects, P: Proj, i: number, j: number, z: number, di: number, dj: number, h: number, top: string, left = dark(top, 0.22), right = dark(top, 0.38)): void {
  poly(r, [P(i, j + dj, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], left);
  poly(r, [P(i + di, j, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i + di, j, z + h)], right);
  poly(r, [P(i, j, z + h), P(i + di, j, z + h), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], top);
  line(r, P(i, j + dj, z + h), P(i + di, j + dj, z + h), lite(top, 0.18));
}

/** iso.py `flat`: a floor parallelogram (a rug, a tile) at height z. */
export function flat(r: Rects, P: Proj, i: number, j: number, di: number, dj: number, c: string, z = 0): void {
  poly(r, [P(i, j, z), P(i + di, j, z), P(i + di, j + dj, z), P(i, j + dj, z)], c);
}

/** iso.py `shadow`: a soft contact shadow under a footprint. */
export function isoShadow(r: Rects, P: Proj, i: number, j: number, di: number, dj: number, a = 0.22): void {
  const [cx, cy] = P(i + di / 2, j + dj / 2);
  shade(r, cx, cy, (di + dj) * HT * 0.55, (di + dj) * HH * 0.55, a);
}

/**
 * Rects sheared onto a wall (iso.py `face`). A rect's x and y are relative to the plane's origin (x0, y0); column u
 * drops by floor(u / 2) on the right wall's plane (slope +1) and rises by ceil(u / 2) on the left wall's (slope -1).
 * Runs of columns with the same drop stay one rect. A fractional origin is rounded, so every cell stays whole.
 */
export function shear(rects: readonly RoomRect[], ox: number, oy: number, slope: 1 | -1): Rects {
  const x0 = Math.round(ox);
  const y0 = Math.round(oy);
  const dy = (u: number) => (slope > 0 ? Math.floor(u / 2) : -Math.ceil(u / 2));
  const out: Rects = [];
  for (const [x, y, w, h, c] of rects) {
    let u = Math.round(x);
    const end = Math.round(x + w);
    while (u < end) {
      const d = dy(u);
      let v = u + 1;
      while (v < end && dy(v) === d) v++;
      R(out, x0 + u, y0 + y + d, v - u, h, c);
      u = v;
    }
  }
  return out;
}

/** Nearest-neighbour resampling of whole-cell rects (window decor onto the iso frame); never below one cell. */
export function scaleRects(rects: readonly RoomRect[], kx: number, ky: number): Rects {
  return rects.map(([x, y, w, h, c]) => {
    const xa = Math.round(x * kx);
    const xb = Math.max(xa + 1, Math.round((x + w) * kx));
    const ya = Math.round(y * ky);
    const yb = Math.max(ya + 1, Math.round((y + h) * ky));
    return [xa, ya, xb - xa, yb - ya, c] as RoomRect;
  });
}

export function moveRects(rects: readonly RoomRect[], dx: number, dy: number): Rects {
  return rects.map(([x, y, w, h, c]) => [x + dx, y + dy, w, h, c] as RoomRect);
}

/** Mirrors rects across the vertical line x = axis (Flip). */
export function mirrorRects(rects: readonly RoomRect[], axis: number): Rects {
  return rects.map(([x, y, w, h, c]) => [2 * axis - x - w, y, w, h, c] as RoomRect);
}

/** The box around the opaque rects (contact shadows and glows are 'rgba(…)' and left out), or null. */
export function opaqueBounds(rects: readonly RoomRect[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h, c] of rects) {
    if (c.startsWith('rgba')) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
