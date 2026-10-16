// Movers in the iso room (spec 2026-10-15 §3.4, §3.7, P3 ruling 11): KIP off its seat and a wandering cat are not in
// the static picture. Each frame draws the cached floor-piece pictures (IsoRun) in depth order with each mover inserted
// at the tile it stands on, a 1 × 1 box in the same topological sort the static room uses. KIP at its seat keeps the
// static picture's own edge (the desk before KIP). Pure.
import { HH, HT, projOf, type IsoGrid } from './grid';
import { KIP_CELLS, type IsoRun } from './room';
import { depthOrder, type DepthBox } from './sort';

export type Tile = readonly [number, number];
export const KIP_MOVER = '@kip';
/** A piece mover's key in the draw order: its placement id after this prefix. */
export const MOVER_PREFIX = '@m:';
export interface MoverAt { key: string; depth: Tile }

const tileBox = (m: MoverAt): DepthBox => ({ key: m.key, i0: m.depth[0], j0: m.depth[1], i1: m.depth[0] + 1, j1: m.depth[1] + 1 });

/** The floor pieces' ids and the movers' keys, back to front. */
export function moverOrder(runs: readonly IsoRun[], movers: readonly MoverAt[], seatEdge: readonly [string, string] | null): string[] {
  return depthOrder([...runs.map((r) => r.box), ...movers.map(tileBox)], seatEdge ? [seatEdge] : []);
}

/** KIP's 32-cell grid top-left standing on a tile's centre (half tiles allowed), whole cells: kipAt's own formula. */
export function kipTileCell(g: Pick<IsoGrid, 'ox' | 'oy'>, pos: readonly [number, number]): [number, number] {
  const [cx, cy] = projOf(g)(pos[0] + 0.5, pos[1] + 0.5);
  return [Math.round(cx) - 8 * KIP_CELLS, Math.round(cy) - 15 * KIP_CELLS];
}

/** A floor piece's anchor (its back corner) on a tile, whole cells: anchorOf's own formula. */
export function pieceTileCell(g: Pick<IsoGrid, 'ox' | 'oy'>, pos: readonly [number, number]): [number, number] {
  return [Math.round(g.ox + (pos[0] - pos[1]) * HT), Math.round(g.oy + (pos[0] + pos[1]) * HH)];
}

export function sameTile(a: Tile | null | undefined, b: Tile | null | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}
