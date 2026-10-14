// Desks (CatDesk.dc.html "DESK"): every desk piece is Spec A's desk and chair plus what stands on it, where the
// monitor stands (x 72-100, top at y 72). A screen shows the KIP stage in its loop frames (Spec A plan ruling 5).
import type { Box } from '../grid';
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt, type MonitorScreen } from '../items';
import { glow, gradV, R, type Rects } from '../paint';
import { accentOn, deskFurniture, mixHex, sprite, three } from './shared';

// The board sprites, verbatim (CatDesk.dc.html:89-91).
const MONITOR: readonly SpriteRect[] = [[0, 0, 26, 13, '#1F2937'], [1, 1, 24, 11, '#0F1A2A'], [3, 3, 10, 1, '#7DD3FC'], [3, 5, 16, 1, '#7DD3FC'], [3, 7, 8, 1, '#7DD3FC'], [12, 13, 3, 2, '#334155'], [8, 15, 11, 1, '#334155']];
const NOTEBOOK: readonly SpriteRect[] = [[0, 0, 22, 4, '#F1F5F9'], [10, 0, 2, 4, '#CBD5E1'], [2, 1, 6, 1, '#94A3B8'], [13, 1, 7, 1, '#94A3B8'], [2, 2, 5, 1, '#94A3B8'], [15, 3, 6, 1, '#FACC15']];
const LAPTOP: readonly SpriteRect[] = [[2, 0, 16, 10, '#334155'], [3, 1, 14, 8, '#0F1A2A'], [5, 3, 6, 1, '#7DD3FC'], [5, 5, 9, 1, '#7DD3FC'], [0, 10, 20, 2, '#94A3B8']];

const LAPTOP_AT = [76, 60] as const; // its 12 rows end on the desk top at y 72
/** The laptop's glass, where its loop frames draw the stage. */
export const LAPTOP_GLASS: Box = { x: LAPTOP_AT[0] + 3, y: LAPTOP_AT[1] + 1, w: 14, h: 8 };

/** The stage on a 14 × 8 glass: three lines and a cursor, three dots, or five bars. */
function laptopScreen(screen: MonitorScreen, k: 0 | 1 | 2, accent: string): Rects {
  const r: Rects = [];
  const { x, y } = LAPTOP_GLASS;
  const L = '#7DD3FC';
  if (screen === 'dots') [3, 6, 9].forEach((dx, i) => R(r, x + dx, y + 3, 2, 2, i === k ? accent : mixHex(accent, '#0F1A2A', 0.55)));
  else if (screen === 'chart') ([[2, 2], [4, 4], [6, 2], [8, 5], [10, 3]] as const).forEach(([bx, bh]) => R(r, x + bx, y + 7 - bh, 1, bh, bx === 8 ? accent : L));
  else { R(r, x + 2, y + 2, 6, 1, L); R(r, x + 2, y + 4, 9, 1, L); if (k !== 2) R(r, x + 9, y + 4, 1, 1, L); }
  return r;
}

const notebook: ItemArt = {
  id: 'desk.notebook', slot: 'desk', style: 'standard',
  draw: ({ ramp }) => {
    const r: Rects = [];
    deskFurniture(r);
    sprite(r, NOTEBOOK, 75, 68, ramp);
    return { base: r };
  },
};

const laptop: ItemArt = {
  id: 'desk.laptop', slot: 'desk', style: 'standard', emissive: true, frames: 3,
  draw: ({ ramp, night, screen }) => {
    const r: Rects = [];
    deskFurniture(r);
    // The board's laptop, with Spec A's v2 glass (no static lines: the loop frames carry the screen).
    sprite(r, LAPTOP.filter(([, , , , c]) => c !== '#7DD3FC' && c !== '#0F1A2A'), LAPTOP_AT[0], LAPTOP_AT[1], ramp);
    gradV(r, LAPTOP_GLASS.x, LAPTOP_GLASS.y, LAPTOP_GLASS.w, LAPTOP_GLASS.h, ['#0B1422', '#0F1A2A', '#132036']);
    const emissive: Rects = [];
    glow(emissive, LAPTOP_GLASS.x + 7, LAPTOP_GLASS.y + 4, 12, 8, '125,211,252', night ? 0.08 : 0.035);
    return { base: r, emissive, frames: three((k) => laptopScreen(screen, k, accentOn(ramp.body))) };
  },
};

registerItems([notebook, laptop]);
registerIcons({ 'desk.monitor': MONITOR, 'desk.notebook': NOTEBOOK, 'desk.laptop': LAPTOP });
