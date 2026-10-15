// The iso art of every placeable piece (spec 2026-10-15 §4): one draw function per item, in the piece's own space,
// for a layer, a facing and a mirror. isoArtOf answers only for an item whose catalogue row has an iso block (the
// Spec A / B slot guards, ledger), so a style, a worn item or a newer server's id is never drawn as a piece. Each
// piece's rects are cached (an LRU of PIECE_CACHE_SIZE, plan ruling 8): a drop rebuilds the room from cached rects.
import { catalogueItem } from '../catalogue';
import type { ItemContext, ItemLayers } from '../items';
import type { ItemId } from '../loadout';
import type { Rects } from '../paint';
import type { PlacementLayer } from './geometry';
import { moveRects } from './prims';

export interface IsoArtOpts {
  layer: PlacementLayer;
  facing: 'L' | 'R';
  mirror: boolean;
}

export interface IsoPieceArt {
  id: ItemId;
  draw(ctx: ItemContext, o: IsoArtOpts): ItemLayers;
}

const ART = new Map<ItemId, IsoPieceArt>();

export function registerIsoArt(list: readonly IsoPieceArt[]): void {
  for (const a of list) ART.set(a.id, a);
}

export function isoArtOf(id: ItemId | null | undefined): IsoPieceArt | undefined {
  return id && catalogueItem(id)?.iso ? ART.get(id) : undefined;
}

export function moveLayers(l: ItemLayers, dx: number, dy: number): ItemLayers {
  const m = (rs: Rects) => moveRects(rs, dx, dy);
  return {
    ...(l.base ? { base: m(l.base) } : {}),
    ...(l.emissive ? { emissive: m(l.emissive) } : {}),
    ...(l.frames ? { frames: l.frames.map(m) as [Rects, Rects, Rects] } : {}),
  };
}

export const PIECE_CACHE_SIZE = 200;
const CACHE = new Map<string, ItemLayers>();

/** A piece's layers in its own space, or null when this build has no iso art for it. Glows and loops only for flagged items. */
export function pieceLayers(id: ItemId, ctx: ItemContext, o: IsoArtOpts): ItemLayers | null {
  const art = isoArtOf(id);
  if (!art) return null;
  const key = [id, o.layer, o.facing, o.mirror ? 1 : 0, ctx.night ? 'n' : 'd', ctx.colour, ctx.screen].join('|');
  const hit = CACHE.get(key);
  if (hit) {
    CACHE.delete(key);
    CACHE.set(key, hit);
    return hit;
  }
  const item = catalogueItem(id)!;
  const drawn = art.draw(ctx, o);
  const layers: ItemLayers = {
    base: drawn.base ?? [],
    ...(item.emissive && drawn.emissive ? { emissive: drawn.emissive } : {}),
    ...(item.frames && drawn.frames ? { frames: drawn.frames } : {}),
  };
  CACHE.set(key, layers);
  if (CACHE.size > PIECE_CACHE_SIZE) CACHE.delete(CACHE.keys().next().value!);
  return layers;
}

export function pieceCacheSize(): number {
  return CACHE.size;
}
export function clearPieceCache(): void {
  CACHE.clear();
}
