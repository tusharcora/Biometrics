// Effect art that is not a piece's own drawing (spec 2026-10-15 §8.2, §8.3): a plant growing from its pot (isox.py
// `plantg`), the floor lamp's warm pool after dark, and the tap squash. Task 5 adds the radio's notes. Pure; every rect
// is in the piece's own space, as standFront leaves it: (0, 0) is its opaque bottom centre.
import type { RoomRect } from '../../grid';
import type { ItemLayers } from '../../items';
import { glow, type Rects } from '../../paint';
import { opaqueBounds } from '../prims';

/** How much of the foliage shows at each stage (ruling 8). */
export const GROWTH: Readonly<Record<number, number>> = { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1 };
/** Pot colours (isox.py's `potc`, plus the succulent tray and the bamboo vase), upper case. */
export const POT_COLOURS: ReadonlySet<string> = new Set([
  '#B45309', '#8C4107', '#D97706', '#F8FAFC', '#E5E7EB', '#C2410C', '#F1F5F9', '#94A3B8', '#CBD5E1', '#BAE6FD',
]);

const isPot = (c: string) => POT_COLOURS.has(c.toUpperCase());

/** The pot stays; leaves above it are cut from the top to the stage's share and narrowed about the centre line. */
export function growRects(rects: readonly RoomRect[], stage: number): Rects {
  const grow = GROWTH[stage] ?? 1;
  const pots = rects.filter(([, , , , c]) => isPot(c));
  if (grow >= 1 || !pots.length) return [...rects];
  const potTop = Math.min(...pots.map(([, y]) => y));
  const isLeaf = ([, y, , , c]: RoomRect) => !c.startsWith('rgba') && !isPot(c) && y < potTop;
  const leaves = rects.filter(isLeaf);
  if (!leaves.length) return [...rects];
  const top = Math.min(...leaves.map(([, y]) => y));
  const cut = Math.ceil(potTop - (potTop - top) * grow);
  const sc = 0.45 + 0.55 * grow;
  const out: Rects = [];
  for (const q of rects) {
    const [x, y, w, h, c] = q;
    if (!isLeaf(q)) { out.push([x, y, w, h, c]); continue; }
    const y0 = Math.max(y, cut);
    const y1 = Math.min(y + h, potTop);
    // Narrowed about x = 0, the piece's own centre line: standFront puts it at the opaque bottom centre, the pot's.
    if (y1 > y0) out.push([Math.round(x * sc), y0, Math.max(1, Math.round(w * sc)), y1 - y0, c]);
  }
  return out;
}

export function growLayers(l: ItemLayers, stage: number): ItemLayers {
  return { ...l, ...(l.base ? { base: growRects(l.base, stage) } : {}) };
}

/** The floor lamp's pool (spec §8.2): drawn in the glow layer, so after the night veil. */
export const POOL = { rx: 30, ry: 15, rgb: '253,224,150', a: 0.1 } as const;
export function lampPool(): Rects {
  const r: Rects = [];
  glow(r, 0, 0, POOL.rx, POOL.ry, POOL.rgb, POOL.a);
  return r;
}

/** A tapped piece's two frames (ruling 17): its height, bottom row fixed. */
export const SQUASH: Readonly<Record<string, number>> = { squash1: 0.7, squash2: 0.85 };
export function squashRects(rects: readonly RoomRect[], k: number): Rects {
  const b = opaqueBounds(rects);
  if (!b) return [...rects];
  const bottom = b.y + b.h;
  return rects.map(([x, y, w, h, c]) => {
    const y0 = bottom - Math.round((bottom - y) * k);
    const y1 = bottom - Math.round((bottom - (y + h)) * k);
    return [x, y0, w, Math.max(1, y1 - y0), c] as RoomRect;
  });
}
