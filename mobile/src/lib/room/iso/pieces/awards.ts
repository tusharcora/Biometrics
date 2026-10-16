// The trophy shelf (spec 2026-10-15 §8.2, §8.3; isox.py `trophy_shelf`): a plank along 4 tiles of its wall, with one
// award on it for each badge level you earn, highest first, up to 8; with none, and whenever it is inert, it is empty.
import { TIERS, tierColors } from '../../../badgeArt';
import type { KipColour } from '../../../kip/kipArt';
import { registerIcons } from '../../icons';
import { spriteRows } from '../../items/shared';
import { R, type Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import type { PlacementLayer } from '../geometry';
import { LOCAL } from '../grid';
import { box } from '../prims';
import { PLANK_DEPTH, PLANK_TOP } from './extras';

/** The shelf's length along its wall, in tiles (its `wall: [8, 3]` is 8 half tiles). */
export const AWARDS_ALONG = 4;

export function drawAwardsShelf(r: Rects, layer: PlacementLayer): void {
  if (layer === 'wallL') box(r, LOCAL, 0, 0, 0, PLANK_DEPTH, AWARDS_ALONG, 2, PLANK_TOP, '#4A382B', '#3A2D23');
  else box(r, LOCAL, 0, 0, 0, AWARDS_ALONG, PLANK_DEPTH, 2, PLANK_TOP, '#4A382B', '#3A2D23');
}

/** Bronze, Silver, Gold, Diamond: the badges' own ring colours (badgeArt TIERS, PF3-COPY). */
export const AWARD_COLOURS: Readonly<Record<1 | 2 | 3 | 4, string>> = { 1: TIERS[1]!.ring, 2: TIERS[2]!.ring, 3: TIERS[3]!.ring, 4: TIERS[4]!.ring };
/** A level's award colour; Legend (level V) is your KIP's colour, as its badge is. */
export const awardColour = (level: number, colour: KipColour): string => tierColors(level, colour).ring;
const CUP = spriteRows(['ccccc', '.ccc.', '..c..', '.ccc.'], { c: '#000000' });

/** The levels a shelf state carries ('a543' → [5, 4, 3]): highest first, at most 8 (spec §8.3). */
export function awardLevels(effect: string | undefined): number[] {
  if (!effect?.startsWith('a')) return [];
  return [...effect.slice(1)].map(Number).filter((n) => n >= 1 && n <= 5).sort((a, b) => b - a).slice(0, 8);
}

const shelf: IsoPieceArt = {
  id: 'shelf.awards',
  draw: (ctx, o) => {
    const r: Rects = [];
    drawAwardsShelf(r, o.layer);
    // One cup a level, 0.45 tiles apart along the plank's top (isox.py `trophy_shelf`).
    awardLevels(o.effect).forEach((lv, k) => {
      const a = 0.25 + k * 0.45;
      const [x, y] = (o.layer === 'wallL' ? LOCAL(0.18, a, 2) : LOCAL(a, 0.18, 2)).map(Math.round) as [number, number];
      const c = awardColour(lv, ctx.colour);
      for (const [sx, sy, w, h] of CUP) R(r, x - 2 + sx, y - 4 + sy, w, h, c);
    });
    return { base: r };
  },
};

registerIsoArt([shelf]);
registerIcons({
  'shelf.awards': spriteRows([
    '.yyy...sss...bbb',
    '.yyy...sss...bbb',
    '..y.....s.....b.',
    '.yyy...sss...bbb',
    'wwwwwwwwwwwwwwww',
    'dddddddddddddddd',
  ], { y: '#FACC15', s: '#CBD5E1', b: '#B45309', w: '#7C5A3E', d: '#5B4636' }),
});
