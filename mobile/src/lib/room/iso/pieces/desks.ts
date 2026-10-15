// KIP's desks (spec 2026-10-15 §2.1, §3.5, §3.6): a 3 × 2 piece, the desk along its back row and KIP's chair on the
// seat tile (1, 1), drawn with real boxes for each facing so the window-side light stays right when turned. What
// stands on the front-on desk (the monitor, the laptop, the notebook, the Cottage typewriter, with their screens'
// loops and glows) stands on the iso desk top. Flip moves the drawer unit and mirrors what stands on top.
import { CATALOGUE } from '../../catalogue';
import { itemArt } from '../../items';
import type { Rects } from '../../paint';
import { moveLayers, registerIsoArt, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { box, dark, isoShadow } from '../prims';
import { filterLayers, onDeskTop, standFront } from './stand';

export const DESK_H = 22;
export interface Wood { top: string; leg: string; chair: string; seat: string }
const SPEC_A: Wood = { top: '#9A7350', leg: '#7C5A3E', chair: '#3F4656', seat: '#475569' };
const OAK: Wood = { top: '#C19A6B', leg: '#8A6542', chair: '#8A6542', seat: '#B88A5A' };

export function deskPiece(id: string, wood: Wood): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const r: Rects = [];
      const turned = o.facing === 'R';
      // a runs along the desk (3 tiles), b from its back to the chair's front (2 tiles); Flip mirrors a.
      const A = (a: number, da: number) => (o.mirror ? 3 - a - da : a);
      const B = (a: number, b: number, z: number, da: number, db: number, h: number, top: string, left?: string, right?: string) => {
        const a0 = A(a, da);
        if (turned) box(r, LOCAL, b, a0, z, db, da, h, top, left, right);
        else box(r, LOCAL, a0, b, z, da, db, h, top, left, right);
      };
      const at = (a: number, b: number, z: number) => (turned ? LOCAL(b, A(a, 0), z) : LOCAL(A(a, 0), b, z));
      if (turned) isoShadow(r, LOCAL, 0, 0, 1, 3, 0.18);
      else isoShadow(r, LOCAL, 0, 0, 3, 1, 0.18);
      // Back legs, the drawer unit at one end (Flip moves it), then the front leg at the other end.
      B(0.1, 0.1, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(2.75, 0.1, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(2.2, 0.12, 0, 0.7, 0.8, DESK_H - 3, wood.leg);
      B(0.1, 0.75, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(0, 0.05, DESK_H - 3, 3, 0.95, 3, wood.top);
      const art = itemArt(id);
      const top = art ? standFront(filterLayers(art.draw(ctx), onDeskTop), o.mirror) : {};
      // LOCAL(1.5, 0.3, 22) is (14.4, -11.2): rounded, so what stands on the desk stays on whole cells.
      const [tx, ty] = at(1.5, 0.3, DESK_H).map(Math.round) as [number, number];
      const onTop = moveLayers(top, tx, ty);
      r.push(...(onTop.base ?? []));
      // KIP's chair on the seat tile, its back toward you (KIP faces the desk while thinking, spec §3.6).
      isoShadow(r, LOCAL, 1, 1, 1, 1, 0.16); // the seat tile is (1, 1) for both facings and under Flip
      B(1.42, 1.42, 0, 0.16, 0.16, 8, '#1F2937');
      B(1.1, 1.1, 8, 0.8, 0.8, 3, wood.seat);
      B(1.1, 1.78, 11, 0.8, 0.12, 14, wood.chair);
      return { base: r, ...(onTop.emissive ? { emissive: onTop.emissive } : {}), ...(onTop.frames ? { frames: onTop.frames } : {}) };
    },
  };
}

registerIsoArt(CATALOGUE.items.filter((i) => i.iso?.kipDesk && itemArt(i.id)).map((i) => deskPiece(i.id, i.id === 'set.cottage.desk' ? OAK : SPEC_A)));
