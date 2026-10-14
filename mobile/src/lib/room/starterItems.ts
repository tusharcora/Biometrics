// The ten placed starter items (spec 2026-10-14 KIP Coach §5): K4's furnishing (docs/design/kip-coach/project/
// K4.dc.html, k4room.js) redrawn on the 170 × 110 grid at Theme sets v2 quality (SetsV2.dc.html, sets2.js):
// perspective walls, lighting, dithered gradients and soft shadows. Plan ruling 2: the desk and monitor sit on
// KIP's left, so KIP faces the monitor mirrored, glancing toward it.
import { darkenHex, mixHex } from '../colour';
import { FLOOR_Y, ROOM_H, ROOM_W, WALL_X0, WALL_X1 } from './grid';
import { registerItems, type ItemArt, type MonitorScreen } from './items';
import { bookRow, clipB, E, floorSeams, glow, gradV, leaf, poly, pot, px, R, shade, type Rects } from './paint';
import { accentOn, deskFurniture, shelfPlank, three, veiled, windowFrame } from './items/shared';

const BOOKS = ['#60A5FA', '#F87171', '#FDE047', '#475569', '#A78BFA', '#34D399'];

/** The monitor's glass, inside its bezel: the loop frames draw the screen content here. */
export const MONITOR_GLASS = { x: 74, y: 50, w: 24, h: 14 } as const;

const plainSlate: ItemArt = {
  id: 'wall.plain',
  slot: 'wallpaper',
  draw: () => {
    const r: Rects = [];
    gradV(r, WALL_X0, 0, WALL_X1 - WALL_X0, FLOOR_Y, ['#323A4B', '#2E3646', '#2A3140', '#262D3B']);
    poly(r, [[0, 0], [WALL_X0, 0], [WALL_X0, FLOOR_Y], [0, FLOOR_Y + 12]], '#232A37');
    poly(r, [[WALL_X1, 0], [ROOM_W, 0], [ROOM_W, FLOOR_Y + 12], [WALL_X1, FLOOR_Y]], '#232A37');
    // K4's panel line and wainscot.
    R(r, WALL_X0, 56, WALL_X1 - WALL_X0, 1, '#3A4357');
    for (let x = WALL_X0 + 4; x < WALL_X1; x += 12) R(r, x, 58, 1, 14, '#2F3747');
    R(r, WALL_X0, FLOOR_Y - 2, WALL_X1 - WALL_X0, 2, '#1E2430');
    return { base: r };
  },
};

const darkOak: ItemArt = {
  id: 'floor.oakDark',
  slot: 'floor',
  draw: () => {
    const r: Rects = [];
    poly(r, [[WALL_X0, FLOOR_Y], [WALL_X1, FLOOR_Y], [ROOM_W, FLOOR_Y + 12], [ROOM_W, ROOM_H], [0, ROOM_H], [0, FLOOR_Y + 12]], '#5B4636');
    floorSeams(r, 10, '#4A382B', [80, 88, 98]);
    // The outer seams run past the front corners in perspective: keep them on the grid.
    return { base: clipB(r, [0, 0, ROOM_W, ROOM_H]) };
  },
};

const plainFrame: ItemArt = {
  id: 'win.plain',
  slot: 'window',
  draw: (ctx) => {
    const r: Rects = [];
    windowFrame(r, ctx);
    return { base: r };
  },
};

const wallCalendar: ItemArt = {
  id: 'art.calendar',
  slot: 'art',
  draw: () => {
    const r: Rects = [];
    R(r, 140, 12, 2, 2, '#94A3B8');
    R(r, 132, 14, 18, 20, '#1F2937');
    R(r, 133, 15, 16, 18, '#F1F5F9');
    R(r, 133, 15, 16, 4, '#DC2626');
    R(r, 133, 15, 16, 1, '#F87171');
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) px(r, 134 + col * 3, 21 + row * 3, '#94A3B8');
    R(r, 140, 24, 2, 2, '#DC2626');
    R(r, 133, 32, 16, 1, '#CBD5E1');
    return { base: r };
  },
};

const books: ItemArt = {
  id: 'shelf.books',
  slot: 'shelf',
  draw: () => {
    const r: Rects = [];
    shade(r, 113, 33, 18, 1.5, 0.12);
    bookRow(r, 98, 30, 128, BOOKS, 3, 10);
    shelfPlank(r);
    return { base: r };
  },
};

const slateRug: ItemArt = {
  id: 'rug.slate',
  slot: 'rug',
  draw: () => {
    const r: Rects = [];
    poly(r, [[40, 92], [134, 92], [144, 106], [30, 106]], '#475569');
    poly(r, [[43, 94], [131, 94], [139, 104], [35, 104]], '#334155');
    poly(r, [[45, 95], [129, 95], [136, 103], [38, 103]], '#475569');
    for (let x = 50; x < 128; x += 8) E(r, x, 99, 1.6, 1, '#3E4A5C');
    return { base: r };
  },
};

function screenContent(screen: MonitorScreen, k: 0 | 1 | 2, accent: string): Rects {
  const r: Rects = [];
  const { x, y } = MONITOR_GLASS;
  const L = '#7DD3FC';
  if (screen === 'dots') {
    // The thinking dots: the lit one moves along.
    [5, 10, 15].forEach((dx, i) => R(r, x + dx, y + 6, 2, 2, i === k ? accent : mixHex(accent, '#0F1A2A', 0.55)));
  } else if (screen === 'chart') {
    ([[3, 3], [6, 5], [9, 2], [12, 6], [15, 4]] as const).forEach(([bx, bh]) => R(r, x + bx, y + 11 - bh, 2, bh, bx === 12 ? accent : L));
    if (k !== 2) R(r, x + 19, y + 3, 1, 2, L);
  } else {
    R(r, x + 2, y + 2, 10, 1, L);
    R(r, x + 2, y + 5, 16, 1, L);
    R(r, x + 2, y + 8, 8, 1, L);
    // A blinking cursor after the last line.
    if (k !== 2) R(r, x + 11, y + 8, 1, 1, L);
  }
  return r;
}

const monitor: ItemArt = {
  id: 'desk.monitor',
  slot: 'desk',
  style: 'standard',
  emissive: true,
  frames: 3,
  draw: ({ night, ramp, screen }) => {
    const r: Rects = [];
    deskFurniture(r);
    // The monitor, its stand and the keyboard.
    R(r, 72, 48, 28, 18, '#1F2937');
    gradV(r, 73, 49, 26, 16, ['#0B1422', '#0F1A2A', '#132036']);
    R(r, 84, 66, 4, 4, '#334155');
    R(r, 80, 70, 12, 2, '#334155');
    R(r, 96, 70, 14, 2, '#475569');
    R(r, 96, 70, 14, 1, '#64748B');
    const emissive: Rects = [];
    glow(emissive, 86, 57, 20, 13, '125,211,252', night ? 0.08 : 0.035);
    return {
      base: r,
      emissive,
      frames: three((k) => screenContent(screen, k, accentOn(ramp.body))),
    };
  },
};

const mug: ItemArt = {
  id: 'item.mug',
  slot: 'desk_item',
  tint: true,
  frames: 3,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    shade(r, 106, 72, 4, 1, 0.2);
    R(r, 104, 66, 4, 6, ramp.body);
    R(r, 104, 66, 4, 1, ramp.light);
    R(r, 107, 66, 1, 6, ramp.shade);
    R(r, 108, 67, 1, 3, ramp.shade);
    // Steam: three wisps rising one cell a frame.
    const steam = three((k) => {
      const f: Rects = [];
      [[105, 63], [106, 61], [105, 59]].forEach(([sx, sy], i) => px(f, sx! + ((i + k) % 2), sy! - k, veiled('rgba(241,245,249,0.45)', night)));
      return f;
    });
    return { base: r, frames: steam };
  },
};

const amberLamp: ItemArt = {
  id: 'lamp.amber',
  slot: 'lamp',
  emissive: true,
  frames: 3,
  draw: ({ night }) => {
    const r: Rects = [];
    const x = 66, yb = 72;
    R(r, x - 3, yb - 2, 8, 2, '#334155');
    R(r, x, yb - 14, 2, 12, '#334155');
    poly(r, [[x - 5, yb - 14], [x + 2, yb - 19], [x + 5, yb - 16], [x - 2, yb - 11]], '#F59E0B');
    poly(r, [[x - 2, yb - 11], [x + 5, yb - 16], [x + 5, yb - 15], [x - 1, yb - 10]], darkenHex('#F59E0B', 0.7));
    const emissive: Rects = [];
    glow(emissive, x - 1, yb - 4, night ? 18 : 10, night ? 11 : 6, '253,224,71', night ? 0.12 : 0.06);
    // A slight flicker of the pool of light.
    const frames = three((k) => {
      const f: Rects = [];
      if (k !== 1) E(f, x - 1, yb - 2, night ? 9 : 5, night ? 3 : 2, `rgba(253,224,71,${k === 0 ? 0.06 : 0.03})`);
      return f;
    });
    return { base: r, emissive, frames };
  },
};

const fern: ItemArt = {
  id: 'plant.fern',
  slot: 'plant',
  draw: () => {
    const r: Rects = [];
    shade(r, 159, 108, 10, 1.5);
    leaf(r, 156, 98, 149, 80, 2.2, '#15803D', '#22C55E');
    leaf(r, 158, 98, 158, 76, 2.4, '#166534', '#4ADE80');
    leaf(r, 160, 98, 167, 82, 2.2, '#15803D', '#22C55E');
    leaf(r, 157, 98, 151, 88, 1.8, '#16A34A', '#86EFAC');
    leaf(r, 161, 98, 166, 90, 1.8, '#16A34A', '#86EFAC');
    pot(r, 158, 108, 12, 9, '#B45309', '#D97706');
    return { base: r };
  },
};

export const STARTER_ITEMS: readonly ItemArt[] = [plainSlate, darkOak, plainFrame, wallCalendar, books, slateRug, monitor, mug, amberLamp, fern];
registerItems(STARTER_ITEMS);
