// The trophy shelf (spec 2026-10-15 §8.2, §8.3; isox.py `trophy_shelf`): a plank along 4 tiles of its wall. Task 5
// stands one award on it for each badge level you earn, up to 8; until then, and whenever it is inert, it is empty.
import { registerIcons } from '../../icons';
import { spriteRows } from '../../items/shared';
import type { Rects } from '../../paint';
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

const shelf: IsoPieceArt = {
  id: 'shelf.awards',
  draw: (_ctx, o) => {
    const r: Rects = [];
    drawAwardsShelf(r, o.layer);
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
