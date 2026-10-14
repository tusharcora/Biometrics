// Corner pieces (CatFloor.dc.html "CORNER"): tall pieces standing in the front-left corner, on the floor at y 95. The
// floor lamp glows from its shade; the punching bag swings in its loop frames.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, R, type Rects } from '../paint';
import { rgbOf, sprite, standing, standingPiece, three, veiled } from './shared';

const FLOOR_ROW = 95;

// The board sprites, verbatim (CatFloor.dc.html:100-107).
const FLOOR_LAMP: readonly SpriteRect[] = [[0, 0, 7, 4, '#FDE68A'], [3, 4, 1, 42, '#94A3B8'], [1, 46, 5, 1, '#94A3B8']];
const YOGA_MAT: readonly SpriteRect[] = [[1, 0, 5, 26, '@b'], [0, 0, 7, 2, '@h'], [2, 0, 3, 2, '@d'], [0, 10, 7, 1, '#1F2937'], [0, 18, 7, 1, '#1F2937']];
const BAG: readonly SpriteRect[] = [[5, 0, 1, 2, '#94A3B8'], [2, 2, 7, 2, '#111827'], [1, 4, 9, 30, '#B91C1C'], [1, 4, 2, 30, '#DC2626'], [2, 34, 7, 2, '#111827'], [5, 36, 1, 4, '#334155'], [0, 40, 11, 3, '#1F2937']];
const BEAN_BAG: readonly SpriteRect[] = [[5, 1, 6, 2, '@h'], [3, 3, 10, 3, '@b'], [1, 6, 14, 8, '@b'], [0, 9, 16, 5, '@s'], [3, 7, 8, 1, '@h']];

// The bean bag is 16 wide and the corner anchor 14: every x and w scaled by 14/16, same colours.
const BEAN_BAG_14: readonly SpriteRect[] = BEAN_BAG.map(([x, y, w, h, c]) => [Math.round((x * 7) / 8), y, Math.max(1, Math.round((w * 7) / 8)), h, c] as const);

const FLOOR_LAMP_AT = [3, 48] as const;
const floorlamp: ItemArt = {
  id: 'corner.floorlamp', slot: 'corner', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, FLOOR_LAMP, FLOOR_LAMP_AT[0], FLOOR_LAMP_AT[1], FLOOR_ROW, ramp);
    const emissive: Rects = [];
    glow(emissive, 6, 50, night ? 18 : 8, night ? 14 : 6, rgbOf('#FDE68A'), night ? 0.12 : 0.06);
    return { base: r, emissive };
  },
};

// Punching bag: the bag's three rects swing one cell right and back; the chain and the stand stay in the base.
const BAG_AT = [2, 52] as const;
const BAG_BODY: readonly SpriteRect[] = [[1, 4, 9, 30, '#B91C1C'], [1, 4, 2, 30, '#DC2626'], [2, 34, 7, 2, '#111827']];
const BAG_FRAME: readonly SpriteRect[] = BAG.filter((rect) => !BAG_BODY.some((b) => b.every((v, i) => v === rect[i])));
const bagFrames = (night: boolean) => three((k) => {
  const f: Rects = [];
  for (const [x, y, w, h, c] of BAG_BODY) R(f, BAG_AT[0] + x + [0, 1, 0][k]!, BAG_AT[1] + y, w, h, veiled(c, night));
  return f;
});
const bag: ItemArt = {
  id: 'corner.bag', slot: 'corner', frames: 3,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, BAG_FRAME, BAG_AT[0], BAG_AT[1], FLOOR_ROW, ramp);
    return { base: r, frames: bagFrames(night) };
  },
};

registerItems([
  floorlamp,
  standingPiece('corner.yogamat', 'corner', YOGA_MAT, 4, 69, FLOOR_ROW, true),
  bag,
  // It ends on y 96, the anchor's last row, so it has no contact shadow below it.
  { id: 'corner.beanbag', slot: 'corner', tint: true, draw: ({ ramp }) => { const r: Rects = []; sprite(r, BEAN_BAG_14, 0, 82, ramp); return { base: r }; } },
]);
registerIcons({ 'corner.floorlamp': FLOOR_LAMP, 'corner.yogamat': YOGA_MAT, 'corner.bag': BAG, 'corner.beanbag': BEAN_BAG });
