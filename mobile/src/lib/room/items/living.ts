// Free-build P3's ginger cat (spec 2026-10-15 §8.2, C5; isox.py `cat_play`): a front-on sprite the iso room stands on
// its tile as a billboard (iso/pieces/stand.ts). Here it sits, its tail flicking over three frames; Task 6 adds the
// play and nap states. Its loop is not lit, so it dims at night (veiled).
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { R, type Rects } from '../paint';
import { spriteRows, standing, three, veiled } from './shared';

export const GINGER = { o: '#EA9A4A', S: '#C2410C', e: '#1F2937', p: '#F9A8D4' } as const;
export const TABBY_SIT: SpriteRect[] = spriteRows([
  '.o.....o..',
  '.oo...oo..',
  '.ooooooo..',
  '.oeoooeo..',
  '.ooopooo..',
  '..ooooo...',
  '.ooSoSooo.',
  '.oooSoSoo.',
  '.oooooooo.',
  '..oo..oo..',
], GINGER);
export const SIT_FOOT = 10;
/** The tail's three frames, at the sitting cat's right side. */
export const TAIL: readonly (readonly SpriteRect[])[] = [
  [[9, 8, 1, 1, GINGER.S], [10, 8, 1, 1, GINGER.S]],
  [[9, 8, 1, 1, GINGER.S], [10, 7, 1, 1, GINGER.S]],
  [[9, 7, 1, 2, GINGER.S], [10, 6, 1, 1, GINGER.S]],
];

export const loopOf = (rects: readonly SpriteRect[], night: boolean): Rects => {
  const f: Rects = [];
  for (const [x, y, w, h, c] of rects) R(f, x, y, w, h, veiled(c, night));
  return f;
};

const tabby: ItemArt = {
  id: 'pet.tabby', slot: 'pet', frames: 3,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, TABBY_SIT, 0, 0, SIT_FOOT, ramp);
    return { base: r, frames: three((k) => loopOf(TAIL[k]!, night)) };
  },
};

registerItems([tabby]);
registerIcons({ 'pet.tabby': [...TABBY_SIT, ...TAIL[0]!] });
