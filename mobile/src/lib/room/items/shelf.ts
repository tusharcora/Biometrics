// Shelf pieces (CatDesk.dc.html "SHELF"): each board sprite stands on Spec A's plank (top at y 30), at x 110. The
// snow globe's flakes fall and the lucky cat waves in their loop frames.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { px, R, type Rects } from '../paint';
import { shelfPlank, sprite, three } from './shared';

/** The board's trophy (CatDesk.dc.html:75). */
const trophy = (a: string, b: string, c: string): SpriteRect[] => [[0, 0, 6, 1, b], [0, 1, 6, 3, a], [-1, 1, 1, 2, a], [6, 1, 1, 2, a], [1, 4, 4, 1, c], [2, 5, 2, 2, c], [1, 7, 4, 1, c], [1, 1, 1, 2, b]];

// The board sprites, verbatim (CatDesk.dc.html:77-84).
const BOOKS: readonly SpriteRect[] = [[0, 1, 2, 7, '#60A5FA'], [2, 0, 2, 8, '#F87171'], [4, 2, 2, 6, '#FDE047'], [6, 2, 2, 6, '#A3E635']];
const MINI_CACTUS: readonly SpriteRect[] = [[1, 6, 5, 3, '#C2410C'], [2, 1, 3, 5, '#65A30D'], [1, 3, 1, 2, '#65A30D'], [5, 2, 1, 2, '#65A30D'], [3, 0, 1, 1, '#F472B6']];
const TROPHY_B: readonly SpriteRect[] = trophy('#B45309', '#D97706', '#92400E');
const GLOBE: readonly SpriteRect[] = [[1, 7, 6, 2, '#7C5A3E'], [2, 0, 4, 1, '#BAE6FD'], [1, 1, 6, 6, '#BAE6FD'], [0, 2, 1, 4, '#BAE6FD'], [7, 2, 1, 4, '#BAE6FD'], [3, 3, 2, 3, '#15803D'], [2, 2, 1, 1, '#F8FAFC'], [5, 1, 1, 1, '#F8FAFC'], [6, 4, 1, 1, '#F8FAFC']];
const LUCKY_CAT: readonly SpriteRect[] = [[0, -1, 1, 1, '#F8FAFC'], [6, -1, 1, 1, '#F8FAFC'], [0, 0, 7, 4, '#F8FAFC'], [0, 3, 7, 6, '#F8FAFC'], [7, -1, 1, 3, '#F8FAFC'], [2, 2, 1, 1, '#1F2937'], [4, 2, 1, 1, '#1F2937'], [0, 4, 7, 1, '#DC2626'], [3, 5, 1, 1, '#FACC15'], [2, 6, 3, 2, '#FACC15']];

function onPlank(id: string, rects: readonly SpriteRect[], x: number, y: number): ItemArt {
  return {
    id, slot: 'shelf',
    draw: ({ ramp }) => {
      const r: Rects = [];
      shelfPlank(r);
      sprite(r, rects, x, y, ramp);
      return { base: r };
    },
  };
}

// Snow globe: three flakes fall a cell a frame inside the glass (the board's three '#F8FAFC' flakes leave the base).
const GLOBE_AT = [110, 21] as const;
const globeFrames = three((k) => {
  const f: Rects = [];
  [[2, 2], [5, 1], [4, 4]].forEach(([x, y], i) => px(f, GLOBE_AT[0] + x!, GLOBE_AT[1] + 1 + ((y! + k + i) % 5), '#F8FAFC'));
  return f;
});
const globe: ItemArt = {
  id: 'shelf.globe', slot: 'shelf', frames: 3,
  draw: ({ ramp }) => {
    const r: Rects = [];
    shelfPlank(r);
    sprite(r, GLOBE.filter(([, , , , c]) => c !== '#F8FAFC'), GLOBE_AT[0], GLOBE_AT[1], ramp);
    return { base: r, frames: globeFrames };
  },
};

// Lucky cat: the raised paw (the rect at x 7, y -1, 1 × 3) waves down and up. Its 9 rows below the ears end on the
// plank at y 30.
const CAT_AT = [110, 21] as const;
const catFrames = three((k) => { const f: Rects = []; R(f, CAT_AT[0] + 7, CAT_AT[1] - 1 + [0, 1, 0][k]!, 1, k === 1 ? 2 : 3, '#F8FAFC'); return f; });
const luckycat: ItemArt = {
  id: 'shelf.luckycat', slot: 'shelf', frames: 3,
  draw: ({ ramp }) => {
    const r: Rects = [];
    shelfPlank(r);
    sprite(r, LUCKY_CAT.filter(([x, y]) => !(x === 7 && y === -1)), CAT_AT[0], CAT_AT[1], ramp);
    return { base: r, frames: catFrames };
  },
};

registerItems([onPlank('shelf.minicactus', MINI_CACTUS, 110, 21), onPlank('shelf.trophyB', TROPHY_B, 110, 22), globe, luckycat]);
registerIcons({ 'shelf.books': BOOKS, 'shelf.minicactus': MINI_CACTUS, 'shelf.trophyB': TROPHY_B, 'shelf.globe': GLOBE, 'shelf.luckycat': LUCKY_CAT });
