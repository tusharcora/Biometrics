// KIP's isometric room grid (spec 2026-10-15 §3.1; docs/design/freebuild/gen/iso.py `Iso`). Tiles are 24 × 12 cells:
// P(i, j, z) = (ox + (i − j)·12, oy + (i + j)·6 − z). i runs down-right along the right wall (j = 0), j down-left
// along the left wall (i = 0), z is height in cells. Walls are 64 cells tall. Drawn at 2 points per cell.
import { tierSize, type Tier } from './geometry';

export const HT = 12;
export const HH = 6;
export const WALL_H = 64;

export type Proj = (i: number, j: number, z?: number) => [number, number];

export interface IsoGrid {
  n: number;
  m: number;
  /** The back corner's floor point, in cells. */
  ox: number;
  oy: number;
  /** The room's size in cells. */
  W: number;
  H: number;
}

export function isoGrid(tier: Tier): IsoGrid {
  const { n, m } = tierSize(tier);
  const ox = m * HT + 2;
  const oy = WALL_H + 4;
  return { n, m, ox, oy, W: (n + m) * HT + 4, H: oy + (n + m) * HH + 8 };
}

export function projOf(g: Pick<IsoGrid, 'ox' | 'oy'>): Proj {
  return (i, j, z = 0) => [g.ox + (i - j) * HT, g.oy + (i + j) * HH - z];
}

/** A piece's own drawing space, its origin at (0, 0): the engine moves it to its anchor. */
export const LOCAL: Proj = projOf({ ox: 0, oy: 0 });

/** The floor point (i, j) under room cell (x, y) at z = 0: P's inverse. */
export function unproject(g: Pick<IsoGrid, 'ox' | 'oy'>, x: number, y: number): [number, number] {
  const a = (x - g.ox) / HT;
  const b = (y - g.oy) / HH;
  return [(a + b) / 2, (b - a) / 2];
}
