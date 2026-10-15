// Free-build P1's own pieces (spec 2026-10-15 §2.1, C7): the wall plank, the welcome lantern (two facings: its lit
// pane faces the lower left or the lower right; Flip moves its ring), and the Cottage fairy lights as a garland on
// the wall (plan ruling 7).
import { registerIcons } from '../../icons';
import { spriteRows, three } from '../../items/shared';
import { glow, poly, R, shade, type Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import { LOCAL, type Proj } from '../grid';
import { box, line } from '../prims';

/** How far the plank stands out of its wall, in tiles, and its top's colour (what stands on it stands on this). */
export const PLANK_DEPTH = 0.35;
export const PLANK_TOP = '#5B4636';
const plank: IsoPieceArt = {
  id: 'shelf.plank',
  draw: (_ctx, o) => {
    const r: Rects = [];
    if (o.layer === 'wallL') box(r, LOCAL, 0, 0, 0, PLANK_DEPTH, 2, 2, PLANK_TOP, '#4A382B', '#3A2D23');
    else box(r, LOCAL, 0, 0, 0, 2, PLANK_DEPTH, 2, PLANK_TOP, '#4A382B', '#3A2D23');
    return { base: r };
  },
};

/** Half the lantern's base, in tiles: the base is a real box centred on its tile centre or spot. */
export const LANTERN_BASE = 0.2;
const lantern: IsoPieceArt = {
  id: 'lamp.welcome',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const [cx, cy] = o.layer === 'floor' ? LOCAL(0.5, 0.5) : [0, 0];
    const C: Proj = (i, j, z = 0) => { const [x, y] = LOCAL(i, j, z); return [x + cx, y + cy]; };
    if (o.layer === 'floor') shade(r, cx, cy, 7, 3, 0.22);
    box(r, C, -LANTERN_BASE, -LANTERN_BASE, 0, 2 * LANTERN_BASE, 2 * LANTERN_BASE, 2, '#44403C');
    box(r, C, -0.16, -0.16, 2, 0.32, 0.32, 9, '#57534E');
    box(r, C, -0.22, -0.22, 11, 0.44, 0.44, 2, '#44403C');
    const pane = o.facing === 'L'
      ? [C(-0.11, 0.16, 4), C(0.11, 0.16, 4), C(0.11, 0.16, 10), C(-0.11, 0.16, 10)]
      : [C(0.16, -0.11, 4), C(0.16, 0.11, 4), C(0.16, 0.11, 10), C(0.16, -0.11, 10)];
    poly(r, pane, '#B45309');
    poly(em, pane, ctx.night ? '#FEF3C7' : '#F59E0B');
    const [hx, hy] = C(0, 0, 13);
    const side = o.mirror ? 2 : -3;
    R(r, Math.round(hx) + side, Math.round(hy) - 3, 1, 3, '#44403C');
    R(r, Math.round(hx) - 1, Math.round(hy) - 4, 3, 1, '#44403C');
    glow(em, cx, cy - 8, ctx.night ? 16 : 8, ctx.night ? 10 : 5, '253,224,71', ctx.night ? 0.08 : 0.04);
    return { base: r, emissive: em };
  },
};

/** The garland's wire hangs this far (tiles) off the wall. */
export const GARLAND_OFF = 0.05;
const garland: IsoPieceArt = {
  id: 'set.cottage.lamp',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const W = (a: number, z: number) => (o.layer === 'wallL' ? LOCAL(GARLAND_OFF, a, z) : LOCAL(a, GARLAND_OFF, z));
    const N = 16;
    // Strung from 0.1 to 3.9 tiles along its 4: an end bulb's night halo stays on its own wall span.
    const bulbs = Array.from({ length: N + 1 }, (_, k) => W(0.1 + (k / N) * 3.8, 7 - 3 * Math.sin((k / N) * Math.PI * 2) ** 2));
    for (let k = 0; k < N; k++) line(r, bulbs[k]!, bulbs[k + 1]!, '#4A4340');
    for (const [x, y] of bulbs) glow(em, x, y + 1, ctx.night ? 4 : 2, ctx.night ? 3 : 2, '253,224,150', ctx.night ? 0.06 : 0.03);
    const frames = three((f) => {
      const fr: Rects = [];
      bulbs.forEach(([x, y], i) => {
        const lit = (i + f) % 4 !== 0;
        R(fr, Math.round(x), Math.round(y) + 1, 1, 1, lit ? '#FDE68A' : '#B59A55');
        if (lit && ctx.night) R(fr, Math.round(x) - 1, Math.round(y), 3, 3, 'rgba(253,230,138,0.18)');
      });
      return fr;
    });
    return { base: r, emissive: em, frames };
  },
};

registerIsoArt([plank, lantern, garland]);

// isox.py's XS lantern, and a plank with two brackets.
registerIcons({
  'lamp.welcome': spriteRows(['..k..', '.kkk.', 'kyyyk', 'kyYyk', 'kyyyk', 'kyyyk', '.kkk.'], { k: '#44403C', y: '#F59E0B', Y: '#FEF3C7' }),
  'shelf.plank': spriteRows(['wwwwwwwwwwwwwwww', 'dddddddddddddddd', '..b..........b..', '..b..........b..'], { w: '#7C5A3E', d: '#5B4636', b: '#3A2D23' }),
});
