// KIP's free-build room (spec 2026-10-15 §2.1, §2.3, §3.2, §3.3, §12): the placement types and, from Task 2, every
// placement rule. Pure and self-contained, with no imports: backend/scripts/export-cosmetics.ts copies this file
// verbatim to mobile/src/lib/room/iso/geometry.ts and tests/room/copy.test.ts fails when the copy is stale, so the
// app's red tint and the server's 400 never disagree.

export type IsoLayer = 'floor' | 'wall' | 'onTop';

export interface IsoSpec {
  /** Where it may go; a cactus: ['floor', 'onTop']. */
  layers: IsoLayer[];
  /** Floor footprint in whole tiles, [along i, along j] facing L; facing R swaps them (plan ruling 2). */
  foot?: [number, number];
  /** Rugs: drawn under everything, never block other pieces, never overlap another rug. */
  flat?: true;
  /** Wall size: half tiles along the wall × 4-cell steps up. */
  wall?: [number, number];
  /** Things can stand on it: spots in tile fractions from the piece's origin, at height z (cells). */
  surface?: { z: number; spots: Array<[number, number]> };
  /** 2 = drawn facing L and R; 1 = Turn is off. */
  facings: 1 | 2;
  /** The desk KIP sits at (one per room). */
  kipDesk?: true;
  /** KIP's tile in the footprint, [along w, along d] facing L. */
  seat?: [number, number];
}

export type PlacementLayer = 'floor' | 'wallL' | 'wallR' | 'onTop';

export interface Placement {
  /** Made by the app: /^[a-z0-9]{1,12}$/, unique in the layout. */
  id: string;
  item: string;
  layer: PlacementLayer;
  /** floor: tile i, j of the back corner; wall: half tile along, 4-cell step up; onTop: 0, 0. */
  x: number;
  y: number;
  facing: 'L' | 'R';
  mirror: boolean;
  /** onTop only: the instance it stands on, and that piece's spot index. */
  parent?: string;
  spot?: number;
}

export const STYLE_KEYS = ['wallpaper', 'floor', 'window'] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

export interface RoomLayout {
  v: 1;
  styles: Record<StyleKey, string>;
  /** Order is not meaningful; the engine sorts. */
  pieces: Placement[];
}

/** 1 starter 7 × 7, 2 bigger 8 × 8, 3 loft 9 × 9 (spec §7). Only the expand route (P2) changes it. */
export type Tier = 1 | 2 | 3;
