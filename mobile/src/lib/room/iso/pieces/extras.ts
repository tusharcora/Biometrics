// Free-build P1's own pieces (spec 2026-10-15 §2.1, C7): the wall plank, the welcome lantern (two facings: its lit
// pane faces the lower left or the lower right; Flip moves its ring), and the Cottage fairy lights as a garland on
// the wall (plan ruling 7).
import { registerIcons, type SpriteRect } from '../../icons';
import { three } from '../../items/shared';
import { glow, poly, R, shade, type Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import { LOCAL, type Proj } from '../grid';
import { box, line } from '../prims';

const plank: IsoPieceArt = {
  id: 'shelf.plank',
  draw: (_ctx, o) => {
    const r: Rects = [];
    if (o.layer === 'wallL') box(r, LOCAL, 0, 0, 0, 0.35, 2, 2, '#5B4636', '#4A382B', '#3A2D23');
    else box(r, LOCAL, 0, 0, 0, 2, 0.35, 2, '#5B4636', '#4A382B', '#3A2D23');
    return { base: r };
  },
};

const lantern: IsoPieceArt = {
  id: 'lamp.welcome',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const [cx, cy] = o.layer === 'floor' ? LOCAL(0.5, 0.5) : [0, 0];
    const C: Proj = (i, j, z = 0) => { const [x, y] = LOCAL(i, j, z); return [x + cx, y + cy]; };
    if (o.layer === 'floor') shade(r, cx, cy, 7, 3, 0.22);
    box(r, C, -0.2, -0.2, 0, 0.4, 0.4, 2, '#44403C');
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

const garland: IsoPieceArt = {
  id: 'set.cottage.lamp',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const W = (a: number, z: number) => (o.layer === 'wallL' ? LOCAL(0.05, a, z) : LOCAL(a, 0.05, z));
    const N = 16;
    const bulbs = Array.from({ length: N + 1 }, (_, k) => W((k / N) * 4, 7 - 3 * Math.sin((k / N) * Math.PI * 2) ** 2));
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

/** A sprite from rows of palette letters ('.' is empty), one rect per run. */
function rows(lines: readonly string[], pal: Readonly<Record<string, string>>): SpriteRect[] {
  const out: SpriteRect[] = [];
  lines.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x]!;
      if (c === '.') { x++; continue; }
      let w = 1;
      while (row[x + w] === c) w++;
      out.push([x, y, w, 1, pal[c]!]);
      x += w;
    }
  });
  return out;
}

// isox.py's XS lantern, and a plank with two brackets.
registerIcons({
  'lamp.welcome': rows(['..k..', '.kkk.', 'kyyyk', 'kyYyk', 'kyyyk', 'kyyyk', '.kkk.'], { k: '#44403C', y: '#F59E0B', Y: '#FEF3C7' }),
  'shelf.plank': rows(['wwwwwwwwwwwwwwww', 'dddddddddddddddd', '..b..........b..', '..b..........b..'], { w: '#7C5A3E', d: '#5B4636', b: '#3A2D23' }),
});
