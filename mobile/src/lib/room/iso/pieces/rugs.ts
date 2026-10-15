// Rugs (spec 2026-10-15 §3.2, §3.5): flat, under everything. A base rug's board pattern (its 60 × 7 icon) is laid
// over its footprint, the long axis along i facing L and along j facing R; Flip mirrors the pattern. The Cottage
// quilt is drawn as its 8 × 2 patchwork.
import { CATALOGUE, isoOf } from '../../catalogue';
import { itemIcon } from '../../icons';
import { spriteBox, tintOf } from '../../items/shared';
import type { Rects } from '../../paint';
import { registerIsoArt, type IsoArtOpts, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { flat } from '../prims';

/** A patch at (u0..u1 along the rug, v0..v1 across), in fractions of the footprint. */
function patch(r: Rects, o: IsoArtOpts, foot: readonly [number, number], u0: number, u1: number, v0: number, v1: number, c: string): void {
  const [w, d] = foot;
  const [a0, a1] = o.mirror ? [1 - u1, 1 - u0] : [u0, u1];
  if (o.facing === 'L') flat(r, LOCAL, a0 * w, v0 * d, (a1 - a0) * w, (v1 - v0) * d, c);
  else flat(r, LOCAL, v0 * d, a0 * w, (v1 - v0) * d, (a1 - a0) * w, c);
}

export function rugPiece(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const icon = itemIcon(id);
      const foot = isoOf(id)?.foot;
      if (!icon || !foot) return {};
      const b = spriteBox(icon);
      const r: Rects = [];
      for (const [x, y, w, h, c] of icon) patch(r, o, foot, (x - b.x) / b.w, (x + w - b.x) / b.w, (y - b.y) / b.h, (y + h - b.y) / b.h, tintOf(c, ctx.ramp));
      return { base: r };
    },
  };
}

const QUILT = ['#E8A0A0', '#8BA77A', '#F5D58A', '#93C5FD'];
const cottageRug: IsoPieceArt = {
  id: 'set.cottage.rug',
  draw: (_ctx, o) => {
    const foot = isoOf('set.cottage.rug')!.foot!;
    const r: Rects = [];
    patch(r, o, foot, 0, 1, 0, 1, '#F5F1E6');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      patch(r, o, foot, (i + 0.08) / 8, (i + 0.92) / 8, j * 0.5 + 0.06, j * 0.5 + 0.44, QUILT[(i + j * 2) % 4]!);
    }
    return { base: r };
  },
};

registerIsoArt([...CATALOGUE.items.filter((i) => i.slot === 'rug' && i.id !== 'set.cottage.rug').map((i) => rugPiece(i.id)), cottageRug]);
