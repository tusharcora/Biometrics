// Desk lamps (CatFloor.dc.html "LAMPS"): each stands on the desk top (y 72) left of the monitor, with a pool of light
// in the glow layer, wider at night.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, type Rects } from '../paint';
import { rgbOf, sprite, tintOf } from './shared';

/** The board's desk lamp (CatFloor.dc.html:76). */
const lamp = (head: string, shadeC: string): SpriteRect[] => [[3, 11, 5, 2, '#334155'], [5, 3, 1, 8, '#334155'], [0, 0, 7, 3, head], [0, 2, 7, 1, shadeC]];

// The board sprite, verbatim (CatFloor.dc.html:93).
const SALT: readonly SpriteRect[] = [[2, 0, 4, 1, '#FDBA74'], [1, 1, 6, 3, '#FB923C'], [0, 4, 8, 4, '#F97316'], [1, 8, 6, 1, '#EA580C'], [1, 9, 6, 2, '#7C5A3E']];

// The board's lamp at (62, 59), a pool of light in the glow layer.
function deskLamp(id: string, head: string, shadeC: string, tint?: true): ItemArt {
  return {
    id, slot: 'lamp', emissive: true, ...(tint ? { tint } : {}),
    draw: ({ ramp, night }) => {
      const r: Rects = [];
      const h = tintOf(head, ramp), s = tintOf(shadeC, ramp);
      sprite(r, lamp(h, s), 62, 59, ramp);
      const emissive: Rects = [];
      glow(emissive, 65, 66, night ? 16 : 9, night ? 10 : 6, rgbOf(h), night ? 0.12 : 0.06);
      return { base: r, emissive };
    },
  };
}
const mint = deskLamp('lamp.mint', '#6EE7B7', '#34D399');
const kiplamp = deskLamp('lamp.kiplamp', '@b', '@s', true);

// The salt lamp glows from its body. It ends on the desk top, the anchor's last row, like the board lamp: no shadow.
const salt: ItemArt = {
  id: 'lamp.salt', slot: 'lamp', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    sprite(r, SALT, 62, 61, ramp);
    const emissive: Rects = [];
    glow(emissive, 66, 66, night ? 16 : 9, night ? 10 : 6, rgbOf('#F97316'), night ? 0.12 : 0.06);
    return { base: r, emissive };
  },
};

registerItems([mint, kiplamp, salt]);
registerIcons({
  'lamp.amber': lamp('#F59E0B', '#D97706'), 'lamp.mint': lamp('#6EE7B7', '#34D399'), 'lamp.kiplamp': lamp('@b', '@s'), 'lamp.salt': SALT,
});
