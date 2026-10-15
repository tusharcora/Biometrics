// KIP drawing engine (prep, not wired in). A port of the approved board's engine
// (docs/design/character/project/Final.dc.html): the 16 x 16 base body with GROUNDED lighting from one body colour,
// the pose-only arms and the moods, plus worn pieces (wornArt.ts). Skins and the idle loop are left out until they
// have a spec.
// Output is a list of one-row runs, like weatherArt.ts.
import type { PixelRect } from '../weatherArt';
import type { WornSlot } from '../room/catalogue';
import { wornArt, wornLayer } from './wornArt';

export const KIP_GRID = 16;

// The v1 colours (owner, 2026-10-10). Coral is the default.
export const KIP_COLOURS = {
  coral: '#FB7185',
  cobalt: '#3B82F6',
  ink: '#2A2F3A',
  lemon: '#FDE047',
  lilac: '#C4B5FD',
  lime: '#A3E635',
  mint: '#6EE7B7',
  sky: '#7DD3FC',
  slate: '#64748B',
  snow: '#F1F5F9',
} as const;
export type KipColour = keyof typeof KIP_COLOURS;
export const DEFAULT_KIP_COLOUR: KipColour = 'coral';

export const KIP_POSES = ['rest', 'wave', 'cheer', 'bottle', 'coffee', 'stretch', 'type', 'think', 'point', 'shrug'] as const;
export type KipPose = (typeof KIP_POSES)[number];
export const KIP_MOODS = ['idle', 'curious', 'sleepy', 'proud', 'startled', 'glance', 'determined'] as const;
export type KipMood = (typeof KIP_MOODS)[number];

export interface KipRamp {
  body: string;
  light: string;
  shade: string;
  deep: string;
  eyes: string;
  white: string;
  shadow: string;
}

export interface KipVariant {
  colour?: KipColour;
  pose?: KipPose;
  mood?: KipMood;
  /** The loop frame, 0–2. Only `type` has three; every other pose ignores it. */
  frame?: number;
  /** Worn pieces by slot (spec 2026-10-14 KIP's room §7). Unknown ids draw nothing. */
  worn?: Partial<Record<WornSlot, string | null>>;
}

// Grid roles: b body, h light, s shade, d deep, e eyes, w white, z ground shadow.
type Role = 'b' | 'h' | 's' | 'd' | 'e' | 'w' | 'z';
type RoleGrid = (Role | null)[][];
export type KipGrid = (string | null)[][];

const E = '................';
const BASE: readonly string[] = [
  E, E, E, E, E, E,
  '....bbbbbbbs....', '....bbbbbbbs....', '....bbbbbbbs....', '....bbbbbbbs....', '....bbbbbbbs....', '....bbbbbbbs....',
  '....bbbbbbbs....',
  '.....b....s.....', '.....b....s.....', '...zzzzzzzzzz...',
];
const EYES: readonly [number, number][] = [[6, 8], [9, 8]];

type EyeMode = 'shut' | 'up' | 'wide' | 'glance';
type HeldItem = { at: [number, number]; rows: readonly string[]; pal: Record<string, string> };

// '@b' and '@s' take the body and shade colours.
const HELD: Record<'bottle' | 'coffee', HeldItem> = {
  bottle: {
    at: [0, 8],
    rows: ['cC..', 'Lw..', 'LwBB', 'lb..', 'lb..'],
    pal: { c: '#F43F5E', C: '#BE123C', L: '#F0F9FF', w: '#BAE6FD', l: '#7DD3FC', b: '#0EA5E9', B: '@b' },
  },
  coffee: {
    at: [12, 7],
    rows: ['..s.', '.s..', '..s.', 'Sccc', '.lll', '.ccC'],
    pal: { s: '#CBD5E1', c: '#F8FAFC', C: '#CBD5E1', l: '#92400E', S: '@s' },
  },
};

type Arm = readonly [number, number, Role];
type PoseDef = {
  arms?: readonly Arm[];
  /** Per-frame arms for a looping pose; overrides `arms`. */
  frames?: readonly (readonly Arm[])[];
  hop?: number; tall?: boolean; eyes?: EyeMode; held?: keyof typeof HELD;
};
const POSES: Record<KipPose, PoseDef> = {
  rest: {},
  wave: { arms: [[12, 9, 's'], [13, 8, 's']] },
  cheer: { arms: [[3, 9, 'b'], [2, 8, 'b'], [12, 9, 's'], [13, 8, 's']], hop: 1 },
  bottle: { held: 'bottle' },
  coffee: { held: 'coffee' },
  stretch: { arms: [[3, 6, 'b'], [3, 5, 'b'], [3, 4, 'b'], [12, 6, 's'], [12, 5, 's'], [12, 4, 's']], tall: true, eyes: 'shut' },
  // KIP Coach (spec 2026-10-14 §4). Typing: both arms forward and low; each frame drops one arm a row.
  type: {
    frames: [
      [[3, 11, 'b'], [2, 11, 'b'], [12, 11, 's'], [13, 11, 's']],
      [[3, 12, 'b'], [2, 12, 'b'], [12, 11, 's'], [13, 11, 's']],
      [[3, 11, 'b'], [2, 11, 'b'], [12, 12, 's'], [13, 12, 's']],
    ],
  },
  // One arm up to the chin.
  think: { arms: [[12, 11, 's'], [13, 10, 's'], [13, 9, 's'], [12, 8, 's']] },
  // One arm out to the side at shoulder height.
  point: { arms: [[3, 8, 'b'], [2, 8, 'b'], [1, 8, 'b']] },
  // Both arms out and up.
  shrug: { arms: [[3, 8, 'b'], [2, 7, 'b'], [12, 8, 's'], [13, 7, 's']] },
};

/** How many loop frames a pose has (§4: `type` alternates its arms over three). */
export function kipPoseFrames(pose: KipPose): number {
  return POSES[pose].frames?.length ?? 1;
}

type MoodDef = { eyes?: EyeMode; tilt?: number; squash?: boolean; tall?: boolean; hop?: number; brows?: boolean };
const MOODS: Record<KipMood, MoodDef> = {
  idle: {},
  curious: { eyes: 'up', tilt: 1 },
  sleepy: { eyes: 'shut', squash: true },
  proud: { eyes: 'up', tall: true },
  startled: { eyes: 'wide', hop: 2 },
  glance: { eyes: 'glance' },
  determined: { eyes: 'shut', brows: true, tilt: -1 },
};

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const toHex = ([r, g, b]: number[]) => `#${hex2(r!)}${hex2(g!)}${hex2(b!)}`;
const mix = (a: string, b: string, k: number) => {
  const x = rgb(a), y = rgb(b);
  return toHex(x.map((v, i) => v * (1 - k) + y[i]! * k));
};
const darken = (a: string, k: number) => toHex(rgb(a).map((v) => v * k));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

/** The GROUNDED ramp from one body colour. */
export function kipRamp(body: string): KipRamp {
  return {
    body,
    light: mix(body, '#FFFFFF', 0.25),
    shade: darken(body, 0.78),
    deep: darken(body, 0.6),
    eyes: luminance(body) > 0.2 ? '#14161B' : '#F5F5F4',
    white: '#F8FAFC',
    shadow: 'rgba(0,0,0,0.35)',
  };
}

const blank = <T,>(): (T | null)[][] => Array.from({ length: KIP_GRID }, () => Array<T | null>(KIP_GRID).fill(null));
const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < KIP_GRID && y < KIP_GRID;
function put<T>(g: (T | null)[][], x: number, y: number, c: T) {
  if (inGrid(x, y)) g[y]![x] = c;
}
// Builds a new grid by passing every painted cell to `move`, which writes it (or skips it) in `out`.
function remap(g: RoleGrid, move: (x: number, y: number, c: Role, out: RoleGrid) => void): RoleGrid {
  const out = blank<Role>();
  for (let y = 0; y < KIP_GRID; y++) for (let x = 0; x < KIP_GRID; x++) {
    const c = g[y]![x];
    if (c) move(x, y, c, out);
  }
  return out;
}

/** Moves a worn layer exactly as the body's posture moves the body: tall, squash, tilt, hop (no shadow). */
function postureLayer(layer: (string | null)[][], p: PoseDef, m: MoodDef, hop: number): (string | null)[][] {
  const move = (g: (string | null)[][], f: (x: number, y: number) => [number, number] | null) => {
    const out = blank<string>();
    for (let y = 0; y < KIP_GRID; y++) for (let x = 0; x < KIP_GRID; x++) {
      const c = g[y]![x];
      if (!c) continue;
      const to = f(x, y);
      if (to) put(out, to[0], to[1], c);
    }
    return out;
  };
  let g = layer;
  if (p.tall || m.tall) g = move(g, (x, y) => [x, y <= 12 ? y - 1 : y]);
  if (m.squash) g = move(g, (x, y) => (y === 7 ? null : [x, y < 7 ? y + 1 : y]));
  if (m.tilt) { const t = m.tilt; g = move(g, (x, y) => [x + (y < 9 ? t : 0), y]); }
  if (hop) g = move(g, (x, y) => [x, y - hop]);
  return g;
}

/** The 16 x 16 grid of fills (null is empty), row by row. */
export function kipGrid(variant: KipVariant): KipGrid {
  const { colour = DEFAULT_KIP_COLOUR, pose = 'rest', mood = 'idle', frame = 0 } = variant;
  const ramp = kipRamp(KIP_COLOURS[colour]);
  const p = POSES[pose];
  const m = MOODS[mood];
  let g = blank<Role>();
  BASE.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') put(g, x, y, c as Role); }));

  const eyeMode = p.eyes ?? m.eyes;
  EYES.forEach(([ex, ey], i) => {
    const side = i === 0 ? -1 : 1;
    if (eyeMode === 'shut') { put(g, ex, ey, 'e'); put(g, ex + side, ey, 'e'); }
    else if (eyeMode === 'up') put(g, ex, ey - 1, 'e');
    else if (eyeMode === 'wide') { put(g, ex, ey, 'e'); put(g, ex, ey - 1, 'e'); }
    else if (eyeMode === 'glance') put(g, ex + 1, ey, 'e');
    else put(g, ex, ey, 'e');
  });
  if (m.brows) EYES.forEach(([ex, ey], i) => put(g, i === 0 ? ex + 1 : ex - 1, ey - 1, 'd'));

  // Posture, in the board's order: tall, squash, tilt, hop.
  const hop = p.hop || m.hop || 0;
  if (p.tall || m.tall) {
    g = remap(g, (x, y, c, out) => {
      if (y <= 12 && c !== 'z') {
        put(out, x, y - 1, c);
        if (y === 12) put(out, x, 12, c);
      } else put(out, x, y, c);
    });
  }
  if (m.squash) {
    g = remap(g, (x, y, c, out) => { if (y !== 7) put(out, x, y < 7 ? y + 1 : y, c); });
    for (let x = 2; x < 14; x++) g[15]![x] = 'z';
  }
  if (m.tilt) {
    const tilt = m.tilt;
    g = remap(g, (x, y, c, out) => put(out, x + (y < 9 ? tilt : 0), y, c));
  }
  if (hop) {
    g = remap(g, (x, y, c, out) => { if (c !== 'z') put(out, x, y - hop, c); });
    const width = hop > 1 ? 6 : 8;
    for (let i = 0; i < width; i++) g[15]![8 - width / 2 + i] = 'z';
  }
  // Arms appear only in poses, and only in empty cells. They are painted after the head, face and neck pieces.
  const armCells = new Set<string>();
  const arms = p.frames ? p.frames[Math.abs(Math.floor(frame)) % p.frames.length]! : p.arms ?? [];
  for (const [ax, ay, role] of arms) {
    const y = ay - hop;
    if (y >= 0 && !g[y]![ax]) { g[y]![ax] = role; armCells.add(`${ax},${y}`); }
  }

  const fills: Record<Role, string> = {
    b: ramp.body, h: ramp.light, s: ramp.shade, d: ramp.deep, e: ramp.eyes, w: ramp.white, z: ramp.shadow,
  };
  const out: KipGrid = g.map((row, y) => row.map((c, x) => (c && !armCells.has(`${x},${y}`) ? fills[c] : null)));
  const paint = (layer: (string | null)[][]) => layer.forEach((row, y) => row.forEach((c, x) => { if (c) out[y]![x] = c; }));
  const layerOf = (slot: WornSlot) => {
    const id = variant.worn?.[slot];
    return id ? postureLayer(wornLayer(id, ramp), p, m, hop) : null;
  };
  // Ruling 5: body, head, face, neck, the pose's arms (over a neck piece), ears, then a held item.
  for (const slot of ['head', 'face', 'neck'] as const) { const l = layerOf(slot); if (l) paint(l); }
  armCells.forEach((k) => { const [x, y] = k.split(',').map(Number); out[y!]![x!] = fills[g[y!]![x!]!]; });
  const ears = layerOf('ears');
  if (ears) paint(ears);

  if (p.held) {
    const item = HELD[p.held];
    item.rows.forEach((row, j) => [...row].forEach((key, k) => {
      if (key === '.') return;
      let fill = item.pal[key]!;
      if (fill.startsWith('@')) fill = fills[fill.slice(1) as Role];
      put(out, item.at[0] + k, item.at[1] + j - hop, fill);
    }));
  }
  return out;
}

/** The sprite mirrored left–right: KIP facing the desk (§4). No back or side view exists. */
export function mirrorGrid(grid: KipGrid): KipGrid {
  return grid.map((row) => [...row].reverse());
}

/** The sprite as one-row runs of one colour, row by row, for react-native-svg Rects. */
export function kipArt(variant: KipVariant): PixelRect[] {
  const rects: PixelRect[] = [];
  kipGrid(variant).forEach((row, y) => {
    let x = 0;
    while (x < KIP_GRID) {
      const fill = row[x];
      if (!fill) { x++; continue; }
      let w = 1;
      while (x + w < KIP_GRID && row[x + w] === fill) w++;
      rects.push({ x, y, w, h: 1, fill });
      x += w;
    }
  });
  return rects;
}

/** The smallest box holding every painted cell of this variant, in grid cells. */
export function kipBounds(variant: KipVariant): { x: number; y: number; w: number; h: number } {
  let minX = KIP_GRID, minY = KIP_GRID, maxX = -1, maxY = -1;
  kipGrid(variant).forEach((row, y) => row.forEach((fill, x) => {
    if (!fill) return;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }));
  return maxX < 0 ? { x: 0, y: 0, w: KIP_GRID, h: KIP_GRID } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** A worn piece's tray icon (spec §8 Icons): rows 0–14 of a resting KIP wearing only that piece. */
export function wornIconRects(id: string, colour: KipColour): PixelRect[] {
  const slot = wornArt(id)?.slot;
  return slot ? kipArt({ colour, pose: 'rest', mood: 'idle', worn: { [slot]: id } }).filter((r) => r.y < 15) : [];
}
