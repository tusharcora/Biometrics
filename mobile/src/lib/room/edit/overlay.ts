// The editor's overlay (spec 2026-10-15 §5.2): the floor's tile lines and the walls' half-tile dots (isogrid on the
// boards), and the selected piece's light outline. Whole cells, translucent.
import type { Box } from '../grid';
import { R, type Rects } from '../paint';
import { WALL_H, projOf, type IsoGrid } from '../iso/grid';
import { line } from '../iso/prims';

const GRID = 'rgba(255,255,255,0.22)';
const DOTS = 'rgba(255,255,255,0.18)';
const OUTLINE = '#F5F5F4';

export function gridRects(g: IsoGrid): Rects {
  const P = projOf(g);
  const r: Rects = [];
  for (let i = 0; i <= g.n; i++) line(r, P(i, 0), P(i, g.m), GRID);
  for (let j = 0; j <= g.m; j++) line(r, P(0, j), P(g.n, j), GRID);
  for (let z = 4; z < WALL_H; z += 8) {
    for (let a = 1; a < 2 * g.n; a++) { const [x, y] = P(a / 2, 0, z); R(r, Math.round(x), Math.round(y), 1, 1, DOTS); }
    for (let a = 1; a < 2 * g.m; a++) { const [x, y] = P(0, a / 2, z); R(r, Math.round(x), Math.round(y), 1, 1, DOTS); }
  }
  return r;
}

/** A one-cell light outline around a box (2 points on screen, spec §5.3). */
export function outlineRects(b: Box): Rects {
  const r: Rects = [];
  R(r, b.x - 1, b.y - 1, b.w + 2, 1, OUTLINE);
  R(r, b.x - 1, b.y + b.h, b.w + 2, 1, OUTLINE);
  R(r, b.x - 1, b.y, 1, b.h, OUTLINE);
  R(r, b.x + b.w, b.y, 1, b.h, OUTLINE);
  return r;
}
