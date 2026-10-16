// Free-build P4's challenge pieces (spec 2026-10-15 §10.4, C3; docs/design/freebuild/gen/c3.py): each theme's piece and
// its trophy. Front-on sprites: the iso room stands them as billboards (iso/pieces/stand.ts), on the floor or a
// surface. The two theme lamps and every trophy glow: unlit in the base (the night veil darkens it), lit with a halo
// in the glow layer, as the candle is. OWNER NOTE (PF4-OWNER): the pieces after Cosy autumn's two are placeholders.
import { darkenHex } from '../../colour';
import type { RoomSlot } from '../catalogue';
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, type Rects } from '../paint';
import { rgbOf, sprite, spriteRows, standing, standingPiece } from './shared';

const HARVEST = spriteRows([
  '...k...',
  '..kkk..',
  '.kyyyk.',
  '.kyYyk.',
  '.kyyyk.',
  '..kkk..',
  '.kkkkk.',
], { k: '#57534E', y: '#F59E0B', Y: '#FEF3C7' });
const MOON = spriteRows([
  '..mmm..',
  '.mmMmm.',
  'mmMMmmm',
  'mmmmmmm',
  '.mmmmm.',
  '...s...',
  '..sss..',
], { m: '#E0E7FF', M: '#FFFFFF', s: '#475569' });
const IVY = spriteRows([
  '.g..g..',
  'gGg.gG.',
  '.gGgGg.',
  '..gGg..',
  '.ttttt.',
  '.ttttt.',
  '..ttt..',
], { g: '#15803D', G: '#4ADE80', t: '#B45309' });
const ORGANISER = spriteRows([
  '.p.r.b.',
  '.p.r.b.',
  'ooooooo',
  'oOoOoOo',
  'ooooooo',
], { p: '#F472B6', r: '#F87171', b: '#60A5FA', o: '#334155', O: '#475569' });
const ACORN = spriteRows([
  '...g...',
  '.bbbbb.',
  'bBbBbBb',
  '.yyyyy.',
  '.yYyyy.',
  '..yyy..',
  '...y...',
], { g: '#713F12', b: '#A16207', B: '#CA8A04', y: '#FACC15', Y: '#FEF08A' });
const CAN = spriteRows([
  '.......y',
  '.yyyy.y.',
  'yYyyyyy.',
  'yYyyyy..',
  'yyyyyy..',
  '.yyyy...',
], { y: '#FACC15', Y: '#FEF08A' });
const OWL = spriteRows([
  '.s...s.',
  '.sssss.',
  'swSsSws',
  'sssssss',
  '.sSsSs.',
  '.sssss.',
  '..o.o..',
], { s: '#CBD5E1', S: '#F1F5F9', w: '#0F172A', o: '#F59E0B' });
const PEN = spriteRows([
  '.k.k.',
  '.k.k.',
  'yyyyy',
  'yYyyy',
  'yyyyy',
], { k: '#1F2937', y: '#FACC15', Y: '#FEF08A' });

/** A glowing billboard: the sprite unlit (darkened) in the base, lit with a halo in the glow layer. */
function glowing(id: string, slot: RoomSlot, rows: readonly SpriteRect[], footY: number, halo: string): ItemArt {
  const unlit: readonly SpriteRect[] = rows.map(([x, y, w, h, c]) => [x, y, w, h, darkenHex(c, 0.55)] as const);
  return {
    id, slot, emissive: true,
    draw: ({ ramp, night }) => {
      const r: Rects = [];
      standing(r, unlit, 0, 0, footY, ramp);
      const emissive: Rects = [];
      sprite(emissive, rows, 0, 0, ramp);
      glow(emissive, 3.5, footY / 2, night ? 9 : 5, night ? 7 : 4, rgbOf(halo), night ? 0.12 : 0.05);
      return { base: r, emissive };
    },
  };
}

registerItems([
  glowing('lamp.harvest', 'lamp', HARVEST, 7, '#FDE68A'),
  standingPiece('plant.ivy', 'plant', IVY, 0, 0, 7),
  glowing('lamp.moon', 'lamp', MOON, 7, '#E0E7FF'),
  standingPiece('item.organiser', 'desk_item', ORGANISER, 0, 0, 5),
  glowing('corner.acorn', 'corner', ACORN, 7, '#FDE047'),
  glowing('corner.can', 'corner', CAN, 6, '#FDE047'),
  glowing('corner.owl', 'corner', OWL, 7, '#E2E8F0'),
  glowing('item.goldpen', 'desk_item', PEN, 5, '#FDE047'),
]);
registerIcons({
  'lamp.harvest': HARVEST, 'plant.ivy': IVY, 'lamp.moon': MOON, 'item.organiser': ORGANISER,
  'corner.acorn': ACORN, 'corner.can': CAN, 'corner.owl': OWL, 'item.goldpen': PEN,
});
