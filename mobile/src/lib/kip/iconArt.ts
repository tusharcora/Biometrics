// The app icon (spec 2026-10-14 KIP Coach §9): direction A, KIP's face close-up, plus its platform variants, drawn
// from KIP's engine so the icon can never drift from KIP. Grids and the raster are pure; scripts/build-icons.mjs
// writes the PNGs. Geometry from docs/design/app-icon/project/Icon.dc.html (`C.face`, `C.block`, `C.a_*`, `sprite`).
import { DEFAULT_KIP_COLOUR, KIP_COLOURS, kipGrid, kipRamp, type KipColour } from './kipArt';

/** A square grid of cells: '#RRGGBB', 'rgba(r,g,b,a)' or null (transparent). */
export type IconGrid = (string | null)[][];

const DARK = '#0A0B0E';
const CARD = '#14161B';

function grid(n: number, fill: string | null = null): IconGrid {
  return Array.from({ length: n }, () => Array<string | null>(n).fill(fill));
}

function rect(g: IconGrid, x: number, y: number, w: number, h: number, c: string | null): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g.length) g[j]![i] = c;
}

/** A: the tile is KIP's block, full bleed: body, the shade side on the right, two 3 × 3 eyes (24 cells). */
export function faceGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  const r = kipRamp(KIP_COLOURS[colour]);
  const g = grid(24, r.body);
  rect(g, 19, 0, 5, 24, r.shade);
  rect(g, 6, 9, 3, 3, r.eyes);
  rect(g, 14, 9, 3, 3, r.eyes);
  return g;
}

/** J: one block and two eyes on the app's dark ground (the iOS dark icon). The contact shadow is pre-composited. */
export function blockGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  const r = kipRamp(KIP_COLOURS[colour]);
  const g = grid(24, DARK);
  rect(g, 0, 18, 24, 6, CARD);
  rect(g, 6, 6, 9, 12, r.body);
  rect(g, 15, 6, 3, 12, r.shade);
  rect(g, 9, 9, 2, 2, r.eyes);
  rect(g, 13, 9, 2, 2, r.eyes);
  rect(g, 5, 18, 14, 1, '#0D0F13');
  return g;
}

const grey = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const l = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = l.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
};

/** J in greyscale on transparent: iOS applies the tint (spec §9). The ground and the card are dropped. */
export function tintedGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  const g = blockGrid(colour);
  return g.map((row, y) => row.map((c) => (c === null || c === DARK || c === CARD || y >= 18 ? null : grey(c))));
}

/** Android adaptive background, 108 dp at 3 dp a cell (36 cells): the body and the shade side. */
export function adaptiveBackgroundGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  const r = kipRamp(KIP_COLOURS[colour]);
  const g = grid(36, r.body);
  rect(g, 25, 0, 11, 36, r.shade);
  return g;
}

/** Android adaptive foreground: the eyes, inside the 66 dp safe circle, on transparent. */
export function adaptiveForegroundGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  const r = kipRamp(KIP_COLOURS[colour]);
  const g = grid(36);
  rect(g, 12, 15, 3, 3, r.eyes);
  rect(g, 20, 15, 3, 3, r.eyes);
  return g;
}

/** Android monochrome: the J block in white with the eyes cut out. */
export function monochromeGrid(): IconGrid {
  const g = grid(36);
  rect(g, 11, 11, 14, 14, '#FFFFFF');
  rect(g, 14, 14, 3, 3, null);
  rect(g, 19, 14, 3, 3, null);
  return g;
}

/** The engine's KIP sprite (rest, idle) on transparent: the splash. */
export function spriteGrid(colour: KipColour = DEFAULT_KIP_COLOUR): IconGrid {
  return kipGrid({ colour, pose: 'rest', mood: 'idle' }).map((row) => [...row]);
}

function rgba(c: string | null): [number, number, number, number] {
  if (!c) return [0, 0, 0, 0];
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0]!, m[1]!, m[2]!, Math.round((m[3] ?? 1) * 255)];
}

/**
 * The grid as RGBA pixels, size × size, nearest neighbour: pixel (x, y) takes cell floor(x · n / size). With
 * `scale` (pixels per cell, the splash) the grid is drawn at that size, centred on a transparent canvas.
 */
export function rasterize(g: IconGrid, size: number, scale?: number): Uint8Array {
  const n = g.length;
  const out = new Uint8Array(size * size * 4);
  const cell = scale ?? size / n;
  const offset = scale ? Math.floor((size - n * scale) / 2) : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.floor((x - offset) / cell), cy = Math.floor((y - offset) / cell);
    const c = cx >= 0 && cy >= 0 && cx < n && cy < n ? g[cy]![cx]! : null;
    out.set(rgba(c), (y * size + x) * 4);
  }
  return out;
}

export interface IconFile {
  file: string;
  size: number;
  grid: () => IconGrid;
  /** Pixels per cell when the art is centred instead of filling the square (the splash). */
  scale?: number;
}

/** Every file app.json names (spec §9 table). */
export const ICON_FILES: readonly IconFile[] = [
  { file: 'assets/icon.png', size: 1024, grid: () => faceGrid() },
  { file: 'assets/icon-dark.png', size: 1024, grid: () => blockGrid() },
  { file: 'assets/icon-tinted.png', size: 1024, grid: () => tintedGrid() },
  { file: 'assets/android-icon-background.png', size: 432, grid: () => adaptiveBackgroundGrid() },
  { file: 'assets/android-icon-foreground.png', size: 432, grid: () => adaptiveForegroundGrid() },
  { file: 'assets/android-icon-monochrome.png', size: 432, grid: () => monochromeGrid() },
  { file: 'assets/splash-icon.png', size: 1024, grid: () => spriteGrid(), scale: 8 },
  { file: 'assets/favicon.png', size: 48, grid: () => faceGrid() },
];
