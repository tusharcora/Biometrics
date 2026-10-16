// Wall art (CatWindow.dc.html "slot · art"): each board sprite hangs centred in the art anchor on a pin, with a soft
// shadow on the wall (shared.artFrame). The clock's minute hand turns (running, it tells the time); the neon heart
// glows.
import { registerItems, type ItemArt } from '../items';
import { registerIcons, type SpriteRect } from '../icons';
import { glow, R, type Rects } from '../paint';
import { artFrame, darkenHex, sprite, spriteBox, three, veiled } from './shared';

// The board sprites, verbatim (CatWindow.dc.html:78-88).
const CALENDAR: readonly SpriteRect[] = [[0, 0, 14, 16, '#F1F5F9'], [0, 0, 14, 4, '#DC2626'], [3, 1, 1, 2, '#1F2937'], [10, 1, 1, 2, '#1F2937'], [2, 6, 2, 2, '#94A3B8'], [5, 6, 2, 2, '#94A3B8'], [8, 6, 2, 2, '#94A3B8'], [11, 6, 2, 2, '#94A3B8'], [2, 9, 2, 2, '#94A3B8'], [5, 9, 2, 2, '#DC2626'], [8, 9, 2, 2, '#94A3B8'], [11, 9, 2, 2, '#94A3B8'], [2, 12, 2, 2, '#94A3B8'], [5, 12, 2, 2, '#94A3B8'], [8, 12, 2, 2, '#94A3B8']];
const MOUNTAIN: readonly SpriteRect[] = [[0, 0, 18, 14, '#1F2937'], [1, 1, 16, 12, '#93C5FD'], [3, 8, 6, 5, '#15803D'], [6, 6, 4, 7, '#15803D'], [10, 9, 6, 4, '#166534'], [12, 3, 2, 2, '#FDE68A']];
const PENNANT: readonly SpriteRect[] = [[0, 0, 1, 14, '#7C5A3E'], [1, 1, 12, 1, '@h'], [1, 2, 10, 2, '@b'], [1, 4, 8, 2, '@b'], [1, 6, 6, 1, '@s'], [1, 7, 4, 1, '@s'], [1, 8, 2, 1, '@d']];
const CLOCK: readonly SpriteRect[] = [[3, 0, 8, 14, '#334155'], [0, 3, 14, 8, '#334155'], [1, 1, 12, 12, '#334155'], [4, 1, 6, 12, '#F1F5F9'], [1, 4, 12, 6, '#F1F5F9'], [2, 2, 10, 10, '#F1F5F9'], [7, 3, 1, 5, '#1F2937'], [7, 7, 4, 1, '#1F2937'], [7, 7, 1, 1, '#DC2626']];
const HEART: readonly SpriteRect[] = [[2, 0, 3, 1, '#F472B6'], [7, 0, 3, 1, '#F472B6'], [1, 1, 5, 1, '#F472B6'], [6, 1, 5, 1, '#F472B6'], [0, 2, 12, 3, '#F472B6'], [1, 5, 10, 1, '#F472B6'], [2, 6, 8, 1, '#F472B6'], [3, 7, 6, 1, '#F472B6'], [4, 8, 4, 1, '#F472B6'], [5, 9, 2, 1, '#F472B6'], [2, 2, 2, 1, '#FBCFE8']];
const MOTTO: readonly SpriteRect[] = [[0, 0, 14, 18, '#F1F5F9'], [1, 1, 12, 16, '#1E1B4B'], [4, 3, 5, 5, '#FDE68A'], [6, 3, 3, 3, '#1E1B4B'], [2, 11, 10, 1, '#F1F5F9'], [3, 13, 8, 1, '#F1F5F9'], [2, 15, 10, 1, '#C4B5FD']];
const BAND: readonly SpriteRect[] = [[0, 0, 14, 18, '#111827'], [1, 1, 12, 16, '#F59E0B'], [3, 3, 8, 8, '#111827'], [4, 4, 6, 6, '#F59E0B'], [6, 6, 2, 2, '#111827'], [2, 13, 10, 1, '#111827'], [4, 15, 6, 1, '#111827']];
const CORK: readonly SpriteRect[] = [[0, 0, 20, 14, '#7C5A3E'], [1, 1, 18, 12, '#C08A5A'], [3, 3, 4, 4, '#FDE047'], [9, 2, 4, 4, '#F9A8D4'], [14, 4, 4, 4, '#93C5FD'], [5, 8, 4, 4, '#A7F3D0'], [12, 9, 5, 3, '#F1F5F9'], [4, 3, 1, 1, '#DC2626'], [10, 2, 1, 1, '#DC2626'], [15, 4, 1, 1, '#DC2626']];
const WAVE: readonly SpriteRect[] = [[0, 0, 20, 14, '#1F2937'], [1, 1, 18, 12, '#EDE6D3'], [1, 9, 18, 4, '#1D4ED8'], [3, 6, 6, 3, '#1D4ED8'], [6, 4, 4, 2, '#1D4ED8'], [8, 3, 3, 1, '#1D4ED8'], [9, 4, 2, 1, '#F8FAFC'], [7, 5, 2, 1, '#F8FAFC'], [2, 8, 3, 1, '#F8FAFC'], [14, 8, 3, 1, '#F8FAFC'], [14, 3, 2, 2, '#DC2626']];

const ANCHOR = { x: 130, y: 12, w: 22, h: 24 }; // Spec A's art anchor: the frame the front-on sprite hangs in

/** Where artFrame puts a sprite's (0, 0): centred in the anchor, 3 cells below its top. */
function originOf(rects: readonly SpriteRect[]): [number, number] {
  const b = spriteBox(rects);
  return [ANCHOR.x + Math.floor((ANCHOR.w - b.w) / 2) - b.x, ANCHOR.y + 3 - b.y];
}

/** "07:12" → { h: 7, m: 12 }; anything else is null. */
export function parseHhmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

/** The cells of a clock hand from (cx, cy), `len` cells long, at `deg` clockwise from 12. */
export function handCells(cx: number, cy: number, len: number, deg: number): Array<[number, number]> {
  const a = (deg * Math.PI) / 180;
  const cells = new Map<string, [number, number]>();
  for (let k = 0; k <= len; k++) {
    const x = Math.round(cx + Math.sin(a) * k);
    const y = Math.round(cy - Math.cos(a) * k);
    cells.set(`${x},${y}`, [x, y]);
  }
  return [...cells.values()];
}

// The clock: the board's face without its hands. Resting, the hour hand is static and the minute hand turns a quarter
// a frame; running (spec §8.2), it shows your real local time, the hands moved once a minute, with no loop (ruling 7).
const CLOCK_FACE: readonly SpriteRect[] = CLOCK.filter(([, , , , c]) => c !== '#1F2937' && c !== '#DC2626');
const clock: ItemArt = {
  id: 'art.clock', slot: 'art', frames: 3,
  draw: ({ ramp, night, effect }) => {
    const r: Rects = [];
    artFrame(r, CLOCK_FACE, ramp, ANCHOR);
    const [ox, oy] = originOf(CLOCK);
    const live = effect?.startsWith('live@') ? parseHhmm(effect.slice(5)) : null;
    if (live) {
      for (const [x, y] of handCells(ox + 7, oy + 7, 3, (live.h % 12) * 30 + live.m / 2)) R(r, x, y, 1, 1, '#1F2937');
      for (const [x, y] of handCells(ox + 7, oy + 7, 4, live.m * 6)) R(r, x, y, 1, 1, '#1F2937');
      R(r, ox + 7, oy + 7, 1, 1, '#DC2626');
      return { base: r };
    }
    R(r, ox + 7, oy + 4, 1, 4, '#1F2937'); // the hour hand
    const HANDS: Array<[number, number, number, number]> = [[7, 3, 1, 5], [7, 7, 4, 1], [7, 7, 1, 4]];
    return {
      base: r,
      frames: three((k) => {
        const f: Rects = [];
        const [x, y, w, h] = HANDS[k]!;
        R(f, ox + x, oy + y, w, h, veiled('#1F2937', night));
        R(f, ox + 7, oy + 7, 1, 1, veiled('#DC2626', night));
        return f;
      }),
    };
  },
};

// The neon heart: the unlit tube in the base (darkened by the night veil), the lit tube and its halo in the glow layer.
const heart: ItemArt = {
  id: 'art.heart', slot: 'art', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    artFrame(r, HEART.map(([x, y, w, h, c]) => [x, y, w, h, darkenHex(c, 0.55)] as const), ramp, ANCHOR);
    const emissive: Rects = [];
    const b = spriteBox(HEART);
    const [ox, oy] = originOf(HEART);
    sprite(emissive, HEART, ox, oy, ramp);
    glow(emissive, ox + b.w / 2, oy + b.h / 2, night ? 14 : 9, night ? 11 : 7, '244,114,182', night ? 0.12 : 0.05);
    return { base: r, emissive };
  },
};

const plain = (id: string, rects: readonly SpriteRect[], tint?: true): ItemArt => ({
  id, slot: 'art', ...(tint ? { tint } : {}),
  draw: ({ ramp }) => { const r: Rects = []; artFrame(r, rects, ramp, ANCHOR); return { base: r }; },
});

registerItems([plain('art.mountain', MOUNTAIN), plain('art.pennant', PENNANT, true), clock, heart, plain('art.motto', MOTTO), plain('art.band', BAND), plain('art.cork', CORK), plain('art.wave', WAVE)]);
registerIcons({
  'art.calendar': CALENDAR, 'art.mountain': MOUNTAIN, 'art.pennant': PENNANT, 'art.clock': CLOCK, 'art.heart': HEART,
  'art.motto': MOTTO, 'art.band': BAND, 'art.cork': CORK, 'art.wave': WAVE,
});
