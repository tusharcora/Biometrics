// Art on a wall (plan ruling 4): the front-on piece (its pin and wall shadow included) centred in its wall span and
// sheared onto the wall, slope +1 on the right wall, -1 on the left (iso.py `wall_art`). Flip mirrors it first.
import { CATALOGUE, isoOf } from '../../catalogue';
import { boundsOf } from '../../grid';
import { itemArt } from '../../items';
import type { Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import { mirrorRects, moveRects, shear } from '../prims';

export function wallArt(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const art = itemArt(id);
      const wall = isoOf(id)?.wall;
      if (!art || !wall) return {};
      const l = art.draw(ctx);
      const b = boundsOf(l.base ?? []);
      if (!b) return {};
      const across = wall[0] * 6;
      const dx = Math.floor((across - b.w) / 2);
      const t = (rs: Rects) => {
        let m = moveRects(rs, dx - b.x, -(b.y + b.h));
        if (o.mirror) m = mirrorRects(m, across / 2);
        // The left wall's screen-left end is the piece's far end along j: LOCAL(0, wall/2) = (-across, across/2).
        return o.layer === 'wallL' ? shear(m, -across, across / 2, -1) : shear(m, 0, 0, 1);
      };
      return {
        base: t(l.base ?? []),
        ...(l.emissive ? { emissive: t(l.emissive) } : {}),
        ...(l.frames ? { frames: l.frames.map(t) as [Rects, Rects, Rects] } : {}),
      };
    },
  };
}

registerIsoArt(CATALOGUE.items.filter((i) => i.slot === 'art' && i.iso).map((i) => wallArt(i.id)));
