// The coin shop's own pieces (spec 2026-10-15 §4: F6, C1), from the boards' sprites (docs/design/freebuild/gen/front.py
// SPR): the old radio, the gnome, the traffic cone, the pumpkin, the candle (its flame glows) and the neon heart sign
// (its tube glows). Front-on sprites only: the iso room stands the small ones as billboards (iso/pieces/stand.ts) and
// hangs the sign on a wall (iso/pieces/wallArt.ts), as it does every piece of their slots.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, type Rects } from '../paint';
import { darkenHex, rgbOf, sprite, spriteRows, standing, standingPiece } from './shared';

const RADIO = spriteRows([
  '...........k...',
  '..........k....',
  '.oooooooookooo.',
  'oOOOOOOOOOOOOOo',
  'oyyyyyyoo.dd.oo',
  'oyHyHyyoodddd.o',
  'oyyyyyyoo.dd..o',
  'oOOOOOOOOOOOOOo',
  '.ss.........ss.',
], { k: '#94A3B8', o: '#92400E', O: '#B45309', y: '#FDE68A', H: '#B45309', d: '#1F2937', s: '#3A2D23' });

const CONE = spriteRows([
  '...oo...',
  '...oo...',
  '..oOoo..',
  '..wwww..',
  '..wwww..',
  '.oooooo.',
  '.oOooooo',
  '.oooooo.',
  'cccccccc',
], { o: '#F97316', O: '#FDBA74', w: '#F1F5F9', c: '#C2410C' });

const GNOME = spriteRows([
  '...r...',
  '..rrr..',
  '..rrrr.',
  '.rrrrr.',
  '.ppppp.',
  '.wwwww.',
  '.wwwww.',
  '.bbbbb.',
  '.bbbbb.',
  '.k...k.',
], { r: '#DC2626', p: '#FCD9B6', w: '#F1F5F9', b: '#2563EB', k: '#1F2937' });

const PUMPKIN = spriteRows([
  '....g...',
  '...g....',
  '.oOoOoo.',
  'oOoOoOoo',
  'oOoOoOoo',
  'oOoOoOoo',
  '.oooooo.',
], { g: '#4D7C0F', o: '#EA580C', O: '#C2410C' });

const FLAME_COLOURS: ReadonlySet<string> = new Set(['#FDE68A', '#F59E0B']);
const CANDLE = spriteRows(['..y..', '..Y..', '.www.', '.www.', '.www.', 'kkkkk'], { y: '#FDE68A', Y: '#F59E0B', w: '#FEF3C7', k: '#78350F' });
const FLAME = CANDLE.filter((r) => FLAME_COLOURS.has(r[4]));
/** The flame unlit in the base (the night veil darkens it); lit, with its halo, in the glow layer. */
const CANDLE_BASE: readonly SpriteRect[] = CANDLE.map(([x, y, w, h, c]) => [x, y, w, h, FLAME_COLOURS.has(c) ? darkenHex(c, 0.55) : c] as const);

const candle: ItemArt = {
  id: 'item.candle', slot: 'desk_item', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, CANDLE_BASE, 0, 0, 6, ramp);
    const emissive: Rects = [];
    sprite(emissive, FLAME, 0, 0, ramp);
    glow(emissive, 2.5, 1, night ? 8 : 4, night ? 6 : 3, rgbOf('#FDE68A'), night ? 0.12 : 0.05);
    return { base: r, emissive };
  },
};

/** front.py's heart at 2 cells a pixel on a 14 × 12 backboard, with a one-row shadow under it. */
const HEART = spriteRows(['.p.p.', 'ppppp', 'ppppp', '.ppp.', '..p..'], { p: '#F472B6' })
  .map(([x, y, w, h, c]) => [2 + 2 * x, 1 + 2 * y, 2 * w, 2 * h, c] as const);
const BOARD: readonly SpriteRect[] = [[0, 0, 14, 12, '#1F2937'], [0, 0, 14, 1, '#334155'], [0, 12, 14, 1, 'rgba(0,0,0,0.25)']];

const sign: ItemArt = {
  id: 'art.neonheart', slot: 'art', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    sprite(r, BOARD, 0, 0, ramp);
    sprite(r, HEART.map(([x, y, w, h, c]) => [x, y, w, h, darkenHex(c, 0.55)] as const), 0, 0, ramp);
    const emissive: Rects = [];
    sprite(emissive, HEART, 0, 0, ramp);
    glow(emissive, 7, 6, night ? 14 : 9, night ? 11 : 7, '244,114,182', night ? 0.12 : 0.05);
    return { base: r, emissive };
  },
};

registerItems([
  standingPiece('item.radio', 'desk_item', RADIO, 0, 0, 9),
  standingPiece('corner.gnome', 'corner', GNOME, 0, 0, 10),
  standingPiece('corner.cone', 'corner', CONE, 0, 0, 9),
  standingPiece('corner.pumpkin', 'corner', PUMPKIN, 0, 0, 7),
  candle,
  sign,
]);
registerIcons({
  'item.radio': RADIO, 'corner.gnome': GNOME, 'corner.cone': CONE, 'corner.pumpkin': PUMPKIN, 'item.candle': CANDLE,
  'art.neonheart': [...BOARD.slice(0, 2), ...HEART],
});
