import { shippedItem } from '../../src/cosmetics/catalogue';
import type { GeometryDeps, Placement, RoomLayout } from '../../src/room/geometry';
import { starterLayout } from '../../src/room/convert';

export const deps: GeometryDeps = { isoOf: (id) => shippedItem(id)?.iso };

/** A placement with the defaults a test does not care about. */
export const piece = (id: string, item: string, over: Partial<Placement> = {}): Placement =>
  ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });

/** The starter layout with these pieces added (or replaced by id). */
export function withPieces(...extra: Placement[]): RoomLayout {
  const base = starterLayout();
  const ids = new Set(extra.map((p) => p.id));
  return { ...base, pieces: [...base.pieces.filter((p) => !ids.has(p.id)), ...extra] };
}
