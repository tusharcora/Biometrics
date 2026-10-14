// Wallpapers (CatWalls.dc.html "slot · wallpaper"). One pattern function fills the room's back wall and the 16 × 16
// tray icon, as on the board. Side walls are the base colour, darker.
import { registerItems, type ItemArt } from '../items';
import { registerIcons, type SpriteRect } from '../icons';
import { R, type Rects } from '../paint';
import type { KipRamp } from '../../kip/kipArt';
import { darkenHex, tintOf, wallSurface } from './shared';

type Pattern = { base: string; draw: (p: Rects, x: number, y: number, w: number, h: number, ramp: KipRamp) => void };

const PATTERNS: Record<string, Pattern> = {
  'wall.plain': { base: '#2A3140', draw: () => undefined },
  'wall.dots': { base: '#2A3140', draw: (p, x0, y0, w, h) => { for (let y = 1; y < h; y += 4) for (let x = y % 8 === 1 ? 1 : 3; x < w; x += 4) R(p, x0 + x, y0 + y, 1, 1, '#4B5568'); } },
  'wall.stripes': { base: '@d', draw: (p, x0, y0, w, h, ramp) => { for (let x = 1; x < w; x += 6) R(p, x0 + x, y0, 2, h, ramp.shade); } },
  'wall.brick': { base: '#5A2A22', draw: (p, x0, y0, w, h) => { for (let y = 0; y < h; y += 4) for (let x = y % 8 ? -4 : 0; x < w; x += 8) R(p, x0 + x + 1, y0 + y, 7, 3, '#8A4434'); } },
  'wall.panel': { base: '#6B4F3A', draw: (p, x0, y0, w, h) => { for (let x = 0; x < w; x += 6) R(p, x0 + x, y0, 1, h, '#5A4130'); R(p, x0, y0, w, 1, '#8A6A4E'); R(p, x0, y0 + Math.floor(h / 2), w, 1, '#5A4130'); } },
  'wall.florals': {
    base: '#3B2F4A',
    draw: (p, x0, y0, w, h) => {
      for (let y = 2; y < h; y += 6) for (let x = y % 12 === 2 ? 2 : 5; x < w; x += 6) {
        R(p, x0 + x, y0 + y - 1, 1, 1, '#F9A8D4'); R(p, x0 + x - 1, y0 + y, 3, 1, '#F9A8D4'); R(p, x0 + x, y0 + y + 1, 1, 1, '#F9A8D4');
        R(p, x0 + x, y0 + y, 1, 1, '#FDE047'); R(p, x0 + x + 1, y0 + y + 2, 1, 1, '#4ADE80');
      }
    },
  },
  'wall.checker': { base: '#E5E7EB', draw: (p, x0, y0, w, h) => { for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) if (((x + y) / 4) % 2) R(p, x0 + x, y0 + y, 4, 4, '#1F2937'); } },
  'wall.subway': { base: '#E5E7EB', draw: (p, x0, y0, w, h) => { for (let y = 0; y < h; y += 3) { R(p, x0, y0 + y, w, 1, '#CBD5E1'); for (let x = y % 6 ? 3 : 0; x < w; x += 6) R(p, x0 + x, y0 + y, 1, 3, '#CBD5E1'); } } },
};

const TINTED = new Set(['wall.stripes']);
const NEW_IDS = ['wall.dots', 'wall.stripes', 'wall.brick', 'wall.panel', 'wall.florals', 'wall.checker', 'wall.subway'];

const art: ItemArt[] = NEW_IDS.map((id) => ({
  id,
  slot: 'wallpaper',
  ...(TINTED.has(id) ? { tint: true } : {}),
  draw: ({ ramp }) => {
    const r: Rects = [];
    const { base, draw } = PATTERNS[id]!;
    const b = tintOf(base, ramp);
    wallSurface(r, b, darkenHex(b, 0.82), (p, x, y, w, h) => draw(p, x, y, w, h, ramp));
    return { base: r };
  },
}));

/** The board's 16 × 16 patch for the tray. */
function patch16(id: string): SpriteRect[] {
  const p: Rects = [];
  const { base, draw } = PATTERNS[id]!;
  R(p, 0, 0, 16, 16, base);
  // Icons keep '@' colours: ItemIcon resolves them in the viewer's KIP colour.
  draw(p, 0, 0, 16, 16, { body: '@b', light: '@h', shade: '@s', deep: '@d', eyes: '', white: '', shadow: '' });
  return p as SpriteRect[];
}

registerItems(art);
registerIcons(Object.fromEntries(['wall.plain', ...NEW_IDS].map((id) => [id, patch16(id)])));
