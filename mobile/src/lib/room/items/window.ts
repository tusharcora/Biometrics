// Window decor (CatWindow.dc.html "slot · window"): every piece is Spec A's plain frame with today's weather in the
// glass (shared.windowFrame), then its board decor sprite. The board's frame interior maps onto Spec A's frame with
// the board's (0, 0) at room cell O.
import { registerItems, type ItemArt, type ItemContext, type ItemLayers } from '../items';
import type { ItemId } from '../loadout';
import { registerIcons, type SpriteRect } from '../icons';
import { glow, R, type Rects } from '../paint';
import { rgbOf, sprite, three, tintOf, veiled, windowFrame } from './shared';

// The board sprites, verbatim (CatWindow.dc.html:76, 93-99).
const WIN: readonly SpriteRect[] = [[0, 0, 34, 30, '#1E2430'], [2, 2, 30, 13, '#8592A6'], [2, 15, 30, 13, '#A3AEC0'], [4, 6, 14, 4, '#E5E7EB'], [16, 9, 15, 5, '#CBD5E1'], [22, 4, 6, 5, '#FCD34D'], [16, 2, 2, 26, '#1E2430'], [2, 14, 30, 1, '#1E2430'], [-2, 29, 38, 2, '#191E28']];
const CURTAINS: readonly SpriteRect[] = [[-3, -3, 40, 1, '#7C5A3E'], [-3, -2, 6, 32, '@b'], [-1, -2, 1, 32, '@s'], [1, -2, 1, 32, '@h'], [31, -2, 6, 32, '@b'], [33, -2, 1, 32, '@s'], [35, -2, 1, 32, '@h']];
const BLINDS: readonly SpriteRect[] = [[2, 2, 30, 1, '#E5E7EB'], [2, 5, 30, 1, '#E5E7EB'], [2, 8, 30, 1, '#E5E7EB'], [2, 11, 30, 1, '#E5E7EB'], [2, 13, 30, 2, '#CBD5E1'], [29, 2, 1, 20, '#94A3B8'], [28, 22, 3, 1, '#94A3B8']];
const STICKER: readonly SpriteRect[] = [[21, 18, 6, 6, '#FBBF24'], [20, 19, 8, 4, '#FBBF24'], [23, 16, 2, 1, '#FDE68A'], [23, 25, 2, 1, '#FDE68A'], [18, 20, 1, 2, '#FDE68A'], [29, 20, 1, 2, '#FDE68A'], [22, 20, 1, 1, '#92400E'], [25, 20, 1, 1, '#92400E'], [23, 22, 2, 1, '#92400E']];
const FAIRY: readonly SpriteRect[] = [[0, 1, 34, 1, '#475569'], [2, 2, 1, 1, '#FDE047'], [6, 3, 1, 1, '#F472B6'], [10, 2, 1, 1, '#67E8F9'], [14, 3, 1, 1, '#FDE047'], [18, 2, 1, 1, '#F472B6'], [22, 3, 1, 1, '#67E8F9'], [26, 2, 1, 1, '#FDE047'], [30, 3, 1, 1, '#F472B6']];
const CHIME: readonly SpriteRect[] = [[16, 2, 1, 4, '#94A3B8'], [12, 6, 9, 1, '#94A3B8'], [12, 7, 1, 5, '#CBD5E1'], [15, 7, 1, 7, '#CBD5E1'], [18, 7, 1, 6, '#CBD5E1'], [20, 7, 1, 4, '#CBD5E1'], [16, 8, 1, 8, '#F472B6'], [16, 16, 2, 3, '#F9A8D4']];

/** The board's (0, 0) in room cells: the curtains' (-3, -3) lands on the window anchor's corner (16, 12). */
export const WINDOW_O = [19, 15] as const;
const O = WINDOW_O;

const FAIRY_WIRE = FAIRY.filter(([, , , , c]) => c === '#475569');
const FAIRY_BULBS = FAIRY.filter(([, , , , c]) => c !== '#475569');
const CHIME_BAR = CHIME.filter(([, y]) => y < 7);
const CHIME_TUBES = CHIME.filter(([, y]) => y >= 7);

const still = (decor: readonly SpriteRect[]) => (ctx: ItemContext): ItemLayers => {
  const r: Rects = [];
  sprite(r, decor, O[0], O[1], ctx.ramp);
  return { base: r };
};

/**
 * Each window style's decor in front-on cells, without the frame and the glass (plan ruling 5): the front-on pieces
 * draw Spec A's frame and then this; the iso window draws its own frame and sky and then this, scaled and sheared.
 */
export const WINDOW_DECOR: Readonly<Record<ItemId, (ctx: ItemContext) => ItemLayers>> = {
  'win.plain': () => ({}),
  'win.curtains': still(CURTAINS),
  'win.blinds': still(BLINDS),
  'win.sticker': still(STICKER),
  // Fairy lights: the wire in the base; each bulb in the glow layer, every third one brighter in turn.
  'win.fairy': (ctx) => {
    const r: Rects = [];
    sprite(r, FAIRY_WIRE, O[0], O[1], ctx.ramp);
    const emissive: Rects = [];
    sprite(emissive, FAIRY_BULBS, O[0], O[1], ctx.ramp);
    if (ctx.night) for (const [x, y, , , c] of FAIRY_BULBS) glow(emissive, O[0] + x + 0.5, O[1] + y + 0.5, 2.5, 2.5, rgbOf(c), 0.1);
    const frames = three((k) => {
      const f: Rects = [];
      FAIRY_BULBS.forEach(([x, y], i) => { if ((i + k) % 3 === 0) R(f, O[0] + x, O[1] + y, 1, 1, '#FFFFFF'); });
      return f;
    });
    return { base: r, emissive, frames };
  },
  // Wind chime: the bar in the base; the tubes and the clapper swing one cell and back.
  'win.chime': (ctx) => {
    const r: Rects = [];
    sprite(r, CHIME_BAR, O[0], O[1], ctx.ramp);
    return {
      base: r,
      frames: three((k) => {
        const f: Rects = [];
        sprite(f, CHIME_TUBES.map(([x, y, w, h, c]) => [x, y, w, h, veiled(tintOf(c, ctx.ramp), ctx.night)] as const), O[0] + [0, 1, -1][k]!, O[1], ctx.ramp);
        return f;
      }),
    };
  },
};

/** A front-on window piece: Spec A's frame with today's sky, then its decor. */
const framed = (id: ItemId, flags: Pick<ItemArt, 'tint' | 'emissive' | 'frames'>): ItemArt => ({
  id, slot: 'window', ...flags,
  draw: (ctx) => {
    const r: Rects = [];
    windowFrame(r, ctx);
    const d = WINDOW_DECOR[id]!(ctx);
    return { base: [...r, ...(d.base ?? [])], ...(d.emissive ? { emissive: d.emissive } : {}), ...(d.frames ? { frames: d.frames } : {}) };
  },
});

registerItems([
  framed('win.curtains', { tint: true }), framed('win.blinds', {}), framed('win.sticker', {}),
  framed('win.fairy', { emissive: true, frames: 3 }), framed('win.chime', { frames: 3 }),
]);

/** The tray icon: the board decor over a small window. */
const SMALL_WINDOW: readonly SpriteRect[] = [[0, 0, 34, 30, '#1E2430'], [2, 2, 30, 26, '#8592A6']];
const onWindow = (decor: readonly SpriteRect[]): readonly SpriteRect[] => [...SMALL_WINDOW, ...decor];
registerIcons({
  'win.plain': WIN,
  'win.curtains': onWindow(CURTAINS),
  'win.blinds': onWindow(BLINDS),
  'win.sticker': onWindow(STICKER),
  'win.fairy': onWindow(FAIRY),
  'win.chime': onWindow(CHIME),
});
