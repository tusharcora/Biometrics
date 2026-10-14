// The Cottage set (spec 2026-10-14 KIP's room §1; SetCottage.dc.html, sets2.js:235-298): plaster and oak beams,
// light oak boards, gingham curtains with a window box, an embroidery hoop, jars and plates, a farmhouse table with
// the sage typewriter, a rose teapot, fairy lights on the beam, a wood stove with a flickering fire, a patchwork rug
// and a dog asleep in its bed. Each piece is redrawn inside its own slot's anchor (the board composes one scene on
// its own layout); the fern is the starter plant.
import { KIP_COLOURS, kipRamp } from '../../../kip/kipArt';
import { registerIcons, type SpriteRect } from '../../icons';
import { registerItems, type ItemArt, type ItemContext } from '../../items';
import { FLOOR_Y, ROOM_H, ROOM_W, WALL_X0, WALL_X1 } from '../../grid';
import { clipB, E, floorSeams, glow, gradV, leaf, poly, px, R, shade, type Rects } from '../../paint';
import { windowSky } from '../../weather';
import { darkenHex, mixHex, three } from '../shared';

/** The Sets card's four swatches (ruling 20): plaster, oak beam, sage, rose. */
export const COTTAGE_SWATCHES = ['#E9DFC9', '#6B4A2F', '#8BA77A', '#E8A0A0'] as const;

const wallpaper: ItemArt = {
  id: 'set.cottage.wallpaper', slot: 'wallpaper',
  draw: () => {
    const r: Rects = [];
    gradV(r, WALL_X0, 0, WALL_X1 - WALL_X0, FLOOR_Y, ['#EFE6D2', '#E9DFC9', '#E2D7BE', '#D8CBAE']);
    poly(r, [[0, 0], [WALL_X0, 0], [WALL_X0, FLOOR_Y], [0, FLOOR_Y + 12]], '#C9BB9B');
    poly(r, [[WALL_X1, 0], [ROOM_W, 0], [ROOM_W, FLOOR_Y + 12], [WALL_X1, FLOOR_Y]], '#C9BB9B');
    for (let x = 12; x < WALL_X1; x += 6) for (let y = 6 + (x % 4) * 3; y < FLOOR_Y; y += 13) px(r, x, y, '#DDD1B6');
    R(r, WALL_X0, 4, WALL_X1 - WALL_X0, 5, '#6B4A2F'); R(r, WALL_X0, 4, WALL_X1 - WALL_X0, 1, '#8A6542'); R(r, WALL_X0, 8, WALL_X1 - WALL_X0, 1, '#523822');
    for (const x of [60, 104]) { R(r, x, 9, 4, FLOOR_Y - 9, '#6B4A2F'); R(r, x, 9, 1, FLOOR_Y - 9, '#8A6542'); }
    R(r, WALL_X0, FLOOR_Y - 2, WALL_X1 - WALL_X0, 2, '#B8A88A');
    return { base: r };
  },
};

const floor: ItemArt = {
  id: 'set.cottage.floor', slot: 'floor',
  draw: () => {
    const r: Rects = [];
    poly(r, [[WALL_X0, FLOOR_Y], [WALL_X1, FLOOR_Y], [ROOM_W, FLOOR_Y + 12], [ROOM_W, ROOM_H], [0, ROOM_H], [0, FLOOR_Y + 12]], '#C19A6B');
    floorSeams(r, 12, '#A57F52', [82, 93]);
    for (let x = 20; x < WALL_X1; x += 24) poly(r, [[x + 6, FLOOR_Y + 4], [x + 7, FLOOR_Y + 4], [x + 7, FLOOR_Y + 6], [x + 6, FLOOR_Y + 6]], '#A57F52');
    return { base: clipB(r, [0, 0, ROOM_W, ROOM_H]) };
  },
};

const win: ItemArt = {
  id: 'set.cottage.window', slot: 'window',
  draw: ({ weather, night }) => {
    const r: Rects = [];
    R(r, 18, 12, 36, 38, '#FFFFFF'); R(r, 19, 13, 34, 36, '#6B4A2F');
    windowSky(r, { x: 21, y: 15, w: 30, h: 32 }, weather, night);
    R(r, 35, 15, 2, 32, '#F5F1E6'); R(r, 21, 30, 30, 2, '#F5F1E6');
    R(r, 16, 48, 40, 2, '#8A6542'); R(r, 18, 50, 36, 5, '#8B5A3C'); R(r, 18, 50, 36, 1, '#A87350');
    ([[21, '#E8A0A0'], [26, '#F472B6'], [31, '#FDE047'], [36, '#E8A0A0'], [41, '#FB7185'], [46, '#F5F1E6'], [50, '#F472B6']] as const).forEach(([x, c], k) => {
      E(r, x + 1, 47, 2.2, 2.2, '#6E9A4A'); E(r, x + 1, 45.5 - (k % 2), 1.6, 1.6, c); px(r, x + 1, 45 - (k % 2), '#FDE68A');
    });
    poly(r, [[16, 12], [25, 12], [23, 30], [19, 54], [16, 54]], '#E8A0A0');
    poly(r, [[47, 12], [56, 12], [56, 54], [53, 54], [49, 30]], '#E8A0A0');
    for (let y = 14; y < 54; y += 4) { R(r, 16, y, 4, 1, '#F5C6C6'); R(r, 52, y, 4, 1, '#F5C6C6'); }
    R(r, 18, 30, 4, 2, '#8BA77A'); R(r, 50, 30, 4, 2, '#8BA77A'); R(r, 16, 12, 40, 1, '#523822');
    return { base: r };
  },
};

const art: ItemArt = {
  id: 'set.cottage.art', slot: 'art',
  draw: () => {
    const r: Rects = [];
    const cx = 141, cy = 25;
    R(r, cx - 1, 14, 2, 3, '#B88A5A');
    E(r, cx, cy, 9, 9, '#B88A5A'); E(r, cx, cy, 8, 8, '#F5F1E6'); E(r, cx, cy, 7, 7, '#EFE8D8');
    leaf(r, cx, cy + 6, cx - 4, cy - 2, 1.4, '#6E9A4A'); leaf(r, cx, cy + 6, cx + 5, cy - 1, 1.4, '#6E9A4A');
    E(r, cx, cy - 3, 2.6, 2.6, '#E8A0A0'); E(r, cx, cy - 3, 1, 1, '#FDE047'); E(r, cx - 4.5, cy + 2, 1.6, 1.6, '#F472B6'); E(r, cx + 5, cy + 3, 1.6, 1.6, '#93C5FD');
    return { base: r };
  },
};

const shelf: ItemArt = {
  id: 'set.cottage.shelf', slot: 'shelf',
  draw: () => {
    const r: Rects = [];
    R(r, 96, 30, 34, 2, '#6B4A2F'); R(r, 96, 30, 34, 1, '#8A6542');
    poly(r, [[98, 32], [102, 32], [98, 34]], '#6B4A2F'); poly(r, [[124, 32], [128, 32], [128, 34]], '#6B4A2F');
    for (const [x, c] of [[102, '#93C5FD'], [112, '#E8A0A0']] as const) { E(r, x, 24, 5, 5, '#F5F1E6'); E(r, x, 24, 3.6, 3.6, c); E(r, x, 24, 2.4, 2.4, '#F5F1E6'); }
    R(r, 97, 28, 20, 2, '#8A6542');
    for (const [x, c] of [[118, '#F59E0B'], [123, '#C2410C'], [127, '#8BA77A']] as const) {
      const w = x === 127 ? 3 : 4;
      R(r, x, 23, w, 7, 'rgba(255,255,255,0.5)'); R(r, x, 25, w, 5, c); R(r, x, 22, w, 2, '#D9C79E');
    }
    return { base: r };
  },
};

// The farmhouse table and chair where Spec A's desk stands, and the sage typewriter where the monitor stands
// (sets2.js:276-279 moved by (-36, +9)). No screen: the stage's dots and chart are not shown (as the notebook).
const desk: ItemArt = {
  id: 'set.cottage.desk', slot: 'desk', style: 'standard',
  draw: () => {
    const r: Rects = [];
    shade(r, 88, 98, 30, 3, 0.12);
    R(r, 64, 76, 3, 23, darkenHex('#8A6542', 0.85)); R(r, 109, 76, 3, 23, darkenHex('#8A6542', 0.85));
    E(r, 65.5, 86, 2.6, 1.4, '#A87350'); E(r, 110.5, 86, 2.6, 1.4, '#A87350');
    R(r, 62, 72, 52, 4, '#C19A6B'); R(r, 62, 72, 52, 1, mixHex('#C19A6B', '#FFFFFF', 0.22)); R(r, 62, 76, 52, 2, '#8A6542');
    // The chair, Spec A's geometry in oak.
    shade(r, 123, 96, 18, 2);
    R(r, 136, 58, 3, 29, '#8A6542'); R(r, 138, 58, 1, 29, '#B88A5A');
    R(r, 108, 84, 31, 3, '#8A6542'); R(r, 108, 84, 31, 1, '#B88A5A');
    R(r, 110, 87, 2, 9, darkenHex('#8A6542', 0.8)); R(r, 134, 87, 2, 9, darkenHex('#8A6542', 0.8));
    // The sage typewriter.
    R(r, 80, 54, 14, 7, '#F5F1E6'); R(r, 81, 56, 10, 1, '#9CA3AF'); R(r, 81, 58, 8, 1, '#9CA3AF');
    R(r, 76, 61, 22, 9, '#8BA77A'); R(r, 76, 61, 22, 1, '#A9C39A'); R(r, 74, 67, 26, 5, '#6E8A5E');
    for (let x = 77; x < 97; x += 3) { px(r, x, 68, '#F5F1E6'); px(r, x + 1, 70, '#F5F1E6'); }
    R(r, 75, 62, 1, 4, '#4A4340'); R(r, 98, 62, 1, 4, '#4A4340');
    return { base: r };
  },
};

const deskItem: ItemArt = {
  id: 'set.cottage.desk_item', slot: 'desk_item',
  draw: () => {
    const r: Rects = [];
    shade(r, 106, 72, 4, 1, 0.2);
    E(r, 107, 69, 3.4, 3, '#E8A0A0'); E(r, 105.5, 67.5, 1.4, 1, '#F5C6C6');
    R(r, 105, 65, 4, 1, '#E8A0A0'); px(r, 106, 64, '#C27878');
    poly(r, [[104, 68], [102, 65], [102.6, 64.6], [104.6, 67]], '#E8A0A0');
    R(r, 109, 67, 1, 3, '#C27878');
    return { base: r };
  },
};

// Fairy lights along the beam (sets2.js:289-295): the wire in the base, the bulbs twinkle in the frames, a warm glow
// at night. Outside the lamp anchor by design (ANCHOR_EXEMPT). Lit bulbs: the frames stay unveiled at night.
const BULBS = Array.from({ length: 24 }, (_, i) => 14 + i * 6).map((x) => ({ x, y: 10 + Math.round(3 * Math.sin(((x - 14) / 144) * Math.PI * 3) ** 2) }));
const lamp: ItemArt = {
  id: 'set.cottage.lamp', slot: 'lamp', emissive: true, frames: 3,
  draw: ({ night }) => {
    const r: Rects = [];
    for (const { x, y } of BULBS) px(r, x, y - 1, '#4A4340');
    const emissive: Rects = [];
    if (night) glow(emissive, 85, 10, 70, 10, '253,224,150', 0.05);
    else glow(emissive, 85, 10, 40, 6, '253,224,150', 0.03);
    const frames = three((k) => {
      const f: Rects = [];
      BULBS.forEach(({ x, y }, i) => {
        const lit = (i + k) % 4 !== 0;
        px(f, x, y, lit ? '#FDE68A' : '#B59A55');
        if (lit && night) R(f, x - 1, y - 1, 3, 3, 'rgba(253,230,138,0.18)');
      });
      return f;
    });
    return { base: r, emissive, frames };
  },
};

// A slim wood stove in the corner, its pipe up the side wall; the fire flickers in the door (sets2.js:290-292).
// The fire is lit: its frames stay unveiled at night. The contact shadow is 14 cells wide, the anchor's width.
const corner: ItemArt = {
  id: 'set.cottage.corner', slot: 'corner', emissive: true, frames: 3,
  draw: ({ night }) => {
    const r: Rects = [];
    shade(r, 7, 95, 7, 1.5);
    R(r, 5, 30, 4, 30, '#2F2A28'); R(r, 5, 30, 1, 30, '#4A4340');
    R(r, 0, 60, 14, 3, '#3A3431'); R(r, 1, 63, 12, 29, '#2F2A28'); R(r, 1, 63, 12, 1, '#4A4340');
    R(r, 3, 70, 8, 10, '#1A1513'); R(r, 4, 71, 6, 8, '#3A1A0C');
    R(r, 2, 92, 2, 3, '#2F2A28'); R(r, 10, 92, 2, 3, '#2F2A28');
    const emissive: Rects = [];
    if (night) glow(emissive, 7, 76, 22, 14, '251,146,60', 0.07);
    else glow(emissive, 7, 76, 8, 6, '251,146,60', 0.05);
    const frames = three((k) => {
      const f: Rects = [];
      const sh = [0, 1, -1][k]!;
      E(f, 7 + sh * 0.5, 77, 3, 2, '#C2410C'); E(f, 7 - sh, 76, 2.2, 2, '#F97316'); E(f, 7 + sh, 75, 1.2, 1.6, '#FDE047');
      return f;
    });
    return { base: r, emissive, frames };
  },
};

const rug: ItemArt = {
  id: 'set.cottage.rug', slot: 'rug',
  draw: () => {
    const r: Rects = [];
    const xl = (y: number) => 40 - ((y - 92) * 10) / 14, xr = (y: number) => 134 + ((y - 92) * 10) / 14;
    poly(r, [[40, 92], [134, 92], [144, 106], [30, 106]], '#F5F1E6');
    const qc = ['#E8A0A0', '#8BA77A', '#F5D58A', '#93C5FD'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      const ya = 93 + j * 7, yb = ya + 6, t0 = i / 8, t1 = (i + 1) / 8;
      const at = (t: number, y: number) => xl(y) + (xr(y) - xl(y)) * t;
      poly(r, [[at(t0, ya) + 0.5, ya], [at(t1, ya) - 0.5, ya], [at(t1, yb) - 0.5, yb], [at(t0, yb) + 0.5, yb]], qc[(i + j * 2) % 4]!);
    }
    return { base: r };
  },
};

const pet: ItemArt = {
  id: 'set.cottage.pet', slot: 'pet',
  draw: () => {
    const r: Rects = [];
    shade(r, 42, 105, 12, 1.2);
    E(r, 42, 101, 12, 4, '#8BA77A'); E(r, 42, 100, 9.5, 2.6, '#6E8A5E');
    E(r, 41, 98.5, 7.5, 2.4, '#D9A066'); E(r, 46, 97, 3.2, 2.2, '#D9A066');
    poly(r, [[44, 96], [45, 93], [47, 96]], '#B07A44'); px(r, 47, 97, '#1F1A17');
    E(r, 38, 99, 3, 1.2, '#E8BB85'); R(r, 31, 103, 22, 1, '#5E7A50');
    return { base: r };
  },
};

const PIECES = [wallpaper, floor, win, art, shelf, desk, deskItem, lamp, corner, rug, pet];
registerItems(PIECES);

// Each piece's tray icon is its own clear-day picture (ItemIcon fits the viewBox to the rects).
const DAY: ItemContext = { weather: 'clear', night: false, colour: 'coral', ramp: kipRamp(KIP_COLOURS.coral), screen: 'lines' };
registerIcons(Object.fromEntries(PIECES.map((p) => [p.id, p.draw(DAY).base as SpriteRect[]])));
