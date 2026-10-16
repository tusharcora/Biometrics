// The boards' small pieces stood in the iso room (plan ruling 3; isox.py `spr_at` and `plant`): the front-on sprite
// with its own contact shadow, glows and loops, its opaque bottom centre on the tile centre or the spot. Front-on
// furniture the iso room draws itself (the shelf plank) is left out.
import { catalogueItem, CATALOGUE } from '../../catalogue';
import type { RoomRect } from '../../grid';
import { itemArt, type ItemLayers } from '../../items';
import { SHELF_TOP } from '../../items/shared';
import type { Rects } from '../../paint';
import { moveLayers, registerIsoArt, type IsoArtOpts, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { mirrorRects, moveRects, opaqueBounds } from '../prims';

type Keep = (q: RoomRect) => boolean;
const DESK_TOP = 72;
/** What stands on a front-on desk: above its top, between its left edge and KIP's chair (Spec A's furniture left out). */
export const onDeskTop: Keep = ([x, y, w, h]) => y + h <= DESK_TOP && x >= 62 && x + w <= 112;
/** Shelf pieces stand on Spec A's plank (top at SHELF_TOP); the iso room has its own planks. */
const KEEP: Partial<Record<string, Keep>> = { shelf: ([, y, , h]) => y + h <= SHELF_TOP };
/**
 * Front-on shelf rows drawn along the whole 34-cell plank: on a spot only the whole rects inside this span stand (at
 * most 24 cells, so a piece never reaches past the next spot, a tile away). The books keep the 8 books from x 103 to
 * 124 (the leaning one among them); the Cottage shelf keeps its plate rail, its jars stay off.
 */
const SPAN: Partial<Record<string, readonly [number, number]>> = { 'shelf.books': [103, 124], 'set.cottage.shelf': [96, 117] };

export function filterLayers(l: ItemLayers, keep: Keep): ItemLayers {
  return {
    ...(l.base ? { base: l.base.filter(keep) } : {}),
    ...(l.emissive ? { emissive: l.emissive } : {}),
    ...(l.frames ? { frames: l.frames.map((f) => f.filter(keep)) as [Rects, Rects, Rects] } : {}),
  };
}

/** A front-on picture moved so its opaque bottom centre is at (0, 0), mirrored about that centre for Flip. */
export function standFront(l: ItemLayers, mirror: boolean): ItemLayers {
  const b = opaqueBounds(l.base ?? []);
  if (!b) return {};
  const cx = Math.round(b.x + b.w / 2);
  const foot = b.y + b.h;
  const t = (rs: Rects) => { const m = moveRects(rs, -cx, -foot); return mirror ? mirrorRects(m, 0) : m; };
  return {
    base: t(l.base ?? []),
    ...(l.emissive ? { emissive: t(l.emissive) } : {}),
    ...(l.frames ? { frames: l.frames.map(t) as [Rects, Rects, Rects] } : {}),
  };
}

/** A billboard stands on its footprint's centre on the floor, on the spot itself on a surface. */
function standAt(o: IsoArtOpts, foot: readonly [number, number]): [number, number] {
  if (o.layer !== 'floor') return [0, 0];
  const [w, d] = o.facing === 'R' ? [foot[1], foot[0]] : foot;
  return LOCAL(w / 2, d / 2);
}

export function standPiece(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const art = itemArt(id);
      const item = catalogueItem(id);
      if (!art || !item?.iso) return {};
      const slotKeep = KEEP[item.slot];
      const span = SPAN[id];
      const keep: Keep | undefined = span
        ? (q) => (!slotKeep || slotKeep(q)) && q[0] >= span[0] && q[0] + q[2] <= span[1]
        : slotKeep;
      const front = keep ? filterLayers(art.draw(ctx), keep) : art.draw(ctx);
      const [dx, dy] = standAt(o, item.iso.foot ?? [1, 1]);
      return moveLayers(standFront(front, o.mirror), dx, dy);
    },
  };
}

const BILLBOARD_SLOTS: ReadonlySet<string> = new Set(['shelf', 'desk_item', 'plant', 'lamp', 'corner', 'pet']);
/** Drawn their own way (extras.ts, awards.ts). */
const OWN_ART: ReadonlySet<string> = new Set(['shelf.plank', 'lamp.welcome', 'set.cottage.lamp', 'shelf.awards']);
registerIsoArt(CATALOGUE.items.filter((i) => i.iso && BILLBOARD_SLOTS.has(i.slot) && !OWN_ART.has(i.id)).map((i) => standPiece(i.id)));
