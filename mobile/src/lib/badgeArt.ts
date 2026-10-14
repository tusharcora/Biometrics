import type { AchievementFamily } from '../api/achievements';
import { contrast } from './colour';
import { KIP_COLOURS, kipRamp, type KipColour } from './kip/kipArt';

// The badge's pixel art (spec 2026-10-06 §6; canvas Badge.dc.html): a pixel octagon, a 12×12 glyph
// per family and the tier colours. Pure data and geometry; BadgeIcon draws it.

/** 12×12 glyphs, '#' = a filled cell: moon, clock, sneaker, check, heart, calendar, sparkle. */
export const GLYPHS: Record<AchievementFamily, readonly string[]> = {
  SLEEP_GOAL: ['.....####...', '...####.....', '..###.......', '.###......#.', '.###.....###', '###.......#.', '###.........', '.###........', '.###........', '..###.......', '...####.....', '.....####...'],
  STEADY_BEDTIME: ['...######...', '..#......#..', '.#...##...#.', '#....##....#', '#....##....#', '#....####..#', '#....####..#', '#..........#', '#..........#', '.#........#.', '..#......#..', '...######...'],
  STEP_GOAL: ['............', '............', '..###.......', '..####......', '..#####.....', '..######....', '..#######...', '.##########.', '############', '############', '.##########.', '............'],
  CHECK_IN: ['............', '..........##', '.........###', '........###.', '.......###..', '##....###...', '###..###....', '.######.....', '..####......', '...##.......', '............', '............'],
  BEST_RECOVERY_WEEK: ['............', '.###....###.', '#####..#####', '############', '############', '############', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............'],
  EVERY_DAY_LOGGED: ['..#......#..', '############', '############', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '############', '............'],
  STEADIEST_MONTH: ['.....##.....', '.....##.....', '.....##.....', '....####....', '...######...', '############', '############', '...######...', '....####....', '.....##.....', '.....##.....', '.....##.....'],
};

export interface TierColors { ring: string; fill: string; glyph: string }

/** Level 0 (locked) to IV (Diamond), exactly as the canvas. Level V (Legend) is your KIP's colour. */
export const TIERS: readonly TierColors[] = [
  { ring: '#3F3F46', fill: '#18181B', glyph: '#52525B' },
  { ring: '#D08A4E', fill: '#3A2414', glyph: '#F0B07A' },
  { ring: '#CBD5E1', fill: '#253041', glyph: '#E2E8F0' },
  { ring: '#FACC15', fill: '#3B300A', glyph: '#FDE68A' },
  { ring: '#67E8F9', fill: '#0E2A33', glyph: '#CFFAFE' },
];

/** A pip not yet earned. */
export const LOCKED_PIP = '#3F3F46';

/** a → b by t (0..1), per channel, "#RRGGBB" in and out. */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, '0'));
  return `#${out.join('')}`.toUpperCase();
}

/** Level V: your KIP's ring, a deep fill and a light glyph (spec 2026-10-14 KIP Coach §7.7). */
export function kipTier(colour: KipColour): TierColors {
  const ramp = kipRamp(KIP_COLOURS[colour]);
  return { ring: ramp.body, fill: mixHex(ramp.deep, '#000000', 0.5), glyph: ramp.light };
}

export function tierColors(level: number, colour: KipColour): TierColors {
  const l = Math.max(0, Math.min(5, Math.round(level)));
  return l === 5 ? kipTier(colour) : TIERS[l]!;
}

/** The dark ground of the celebration and the badge share card: the ring, 90% toward near-black. */
export function badgeGround(ring: string): string {
  return mixHex(ring, '#0B0B0F', 0.9);
}

/**
 * The app surfaces a badge's text and pips sit on, the harder of page and card in each theme: on light the
 * page (#F6F6F7) is darker than the card, on dark the card (#14161B) is lighter than the page.
 */
export const TIER_SURFACE = { light: '#F6F6F7', dark: '#14161B' } as const;

const MIN_TIER_CONTRAST = 4.6;

/** `color` mixed toward white (on a dark surface) or black (on a light one) until it reads at 4.5:1, with headroom. */
function readableOn(color: string, surface: string): string {
  const toward = contrast('#FFFFFF', surface) >= contrast('#000000', surface) ? '#FFFFFF' : '#000000';
  for (let i = 0; i <= 20; i++) {
    const c = i === 0 ? color.toUpperCase() : mixHex(color, toward, i * 0.05);
    if (contrast(c, surface) >= MIN_TIER_CONTRAST) return c;
  }
  return toward;
}

/**
 * A tier's colours as text and UI marks (pips, a progress fill, a button) on `surface`. Level V (Legend) is your
 * KIP's colour made readable there, since a dark KIP (ink, slate) would vanish on a dark ground; the badge's own
 * ring art keeps the raw ramp (tierColors). Levels 0 to IV are the canvas colours, unchanged.
 */
export function tierInk(level: number, colour: KipColour, surface: string): { ring: string; glyph: string } {
  const t = tierColors(level, colour);
  if (Math.round(level) < 5) return { ring: t.ring, glyph: t.glyph };
  return { ring: readableOn(t.ring, surface), glyph: readableOn(t.glyph, surface) };
}

/**
 * Small text in a tier's colour (the ladder's EARNED / NEXT). The pale rings (Silver, Gold, Diamond,
 * light KIP colours) vanish on the light page, so light mode darkens the ring by 55% toward black:
 * every tier and KIP colour then clears 4.5:1 on the light page and card. Dark mode keeps the ring,
 * made readable for level V (tierInk).
 */
export function tierTextColor(level: number, colour: KipColour, dark: boolean): string {
  const ring = tierColors(level, colour).ring;
  return dark ? tierInk(level, colour, TIER_SURFACE.dark).ring : mixHex(ring, '#000000', 0.55);
}

/** [col, row] of every filled cell, row by row. */
export function glyphCells(family: AchievementFamily): Array<[col: number, row: number]> {
  const cells: Array<[number, number]> = [];
  GLYPHS[family].forEach((row, r) => row.split('').forEach((ch, c) => {
    if (ch === '#') cells.push([c, r]);
  }));
  return cells;
}

/** The octagon (corners cut at 30% / 70%) inside a `size` box, inset by `inset` on every side. */
export function octagonPoints(inset: number, size = 100): string {
  const w = size - 2 * inset;
  const at = (f: number) => +(inset + w * f).toFixed(2);
  const corners: Array<[number, number]> = [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]];
  return corners.map(([x, y]) => `${at(x)},${at(y)}`).join(' ');
}
