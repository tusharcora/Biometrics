// Free-build P3's ginger cat (spec 2026-10-15 §8.2, C5; isox.py `cat_play`): a front-on sprite the iso room stands on
// its tile as a billboard (iso/pieces/stand.ts). It sits with its tail flicking over three frames, plays with a paw, or
// naps curled up under drifting z's (ruling 10). Its loop is not lit, so it dims at night (veiled).
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

export const TABBY_NAP: SpriteRect[] = spriteRows([
  '....oooo....',
  '..oooooooo..',
  '.ooSoSoooooo',
  'oooSoSooeeoo',
  'oooooooooooo',
  '.oooooooooo.',
], GINGER);
const NAP_FOOT = 6;
/** One "z" drifting up from the curled cat. */
export const ZZ: readonly (readonly SpriteRect[])[] = [
  [[10, -3, 2, 1, '#E5E7EB'], [11, -2, 1, 1, '#E5E7EB'], [10, -1, 2, 1, '#E5E7EB']],
  [[11, -6, 2, 1, '#E5E7EB'], [12, -5, 1, 1, '#E5E7EB'], [11, -4, 2, 1, '#E5E7EB']],
  [[12, -9, 2, 1, '#E5E7EB'], [13, -8, 1, 1, '#E5E7EB'], [12, -7, 2, 1, '#E5E7EB']],
];
/** A paw batting at the air (isox.py `cat_play`). */
export const PAW: readonly (readonly SpriteRect[])[] = [
  [[0, 8, 1, 1, GINGER.o]],
  [[0, 6, 1, 2, GINGER.o]],
  [[0, 5, 1, 1, GINGER.o], [1, 6, 1, 1, GINGER.o]],
];

/** sit (still, wandering or resting), play or nap: the state is the cat's effect (Task 4's roomEffects). */
const tabby: ItemArt = {
  id: 'pet.tabby', slot: 'pet', frames: 3,
  draw: ({ ramp, night, effect }) => {
    const r: Rects = [];
    if (effect === 'nap') {
      standing(r, TABBY_NAP, 0, 0, NAP_FOOT, ramp);
      return { base: r, frames: three((k) => loopOf(ZZ[k]!, night)) };
    }
    standing(r, TABBY_SIT, 0, 0, SIT_FOOT, ramp);
    const loop = (k: 0 | 1 | 2) => (effect === 'play' ? [...PAW[k]!, ...TAIL[(k + 1) % 3]!] : TAIL[k]!);
    return { base: r, frames: three((k) => loopOf(loop(k), night)) };
  },
};

registerItems([tabby]);
registerIcons({ 'pet.tabby': [...TABBY_SIT, ...TAIL[0]!] });
