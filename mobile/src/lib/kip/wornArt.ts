// What KIP can wear (spec 2026-10-14 KIP's room §7): each piece is a few rows of cells on KIP's 16 × 16 grid,
// ported from CatOutfit.dc.html:68-90 (offset `at`, `rows`, palette; '@b' '@h' '@s' '@d' are KIP's body, light,
// shade and deep). Worn pieces never move or reshape the body (kipArt.ts draws them, ruling 5) and never animate
// (ruling 4). Only release-1 pieces are here; the rest come with their art.
import type { KipRamp } from './kipArt';
import { EMPTY_WORN, type KipWorn } from '../room/loadout';
import { WORN_SLOTS, type WornSlot } from '../room/slots';

export interface WornArt {
  id: string;
  slot: WornSlot;
  /** The top-left of `rows` on the 16 × 16 grid. */
  at: readonly [number, number];
  rows: readonly string[];
  pal: Readonly<Record<string, string>>;
}

export const WORN_ART: readonly WornArt[] = [
  { id: 'out.beanie', slot: 'head', at: [4, 2], rows: ['...wW...', '.LLrrrR.', 'LrrrrrrR', 'ddddddDD'], pal: { w: '#F8FAFC', W: '#CBD5E1', r: '#EF4444', L: '#F87171', R: '#B91C1C', d: '#B91C1C', D: '#7F1D1D' } },
  { id: 'out.cap', slot: 'head', at: [4, 4], rows: ['.LbbbbR....', 'bbbbbbbbkkk'], pal: { b: '#2563EB', L: '#60A5FA', R: '#1E40AF', k: '#1E3A8A' } },
  { id: 'out.sweatband', slot: 'head', at: [4, 6], rows: ['wwwwwwww', 'rrrrrrrr'], pal: { w: '#F8FAFC', r: '#DC2626' } },
  { id: 'out.bucket', slot: 'head', at: [3, 3], rows: ['..cccccc..', '..dddddd..', 'bbbbbbbbbb'], pal: { c: '@h', d: '@d', b: '@s' } },
  { id: 'out.hachimaki', slot: 'head', at: [4, 6], rows: ['wwwrrwwwwW', '.........W'], pal: { w: '#F8FAFC', r: '#DC2626', W: '#E5E7EB' } },
  { id: 'out.beret', slot: 'head', at: [4, 3], rows: ['...k.....', '.bbbbbb..', 'bbbbbbbbb'], pal: { b: '#B91C1C', k: '#111827' } },
  { id: 'out.party', slot: 'head', at: [6, 0], rows: ['..y..', '..p..', '.ppp.', '.pyp.', 'ppppp', 'pypyp'], pal: { p: '@h', y: '#FDE047' } },
  { id: 'out.round', slot: 'face', at: [5, 7], rows: ['FFFFFf', 'f.ff.f', 'ffffff'], pal: { F: '#FCD34D', f: '#D97706' } },
  { id: 'out.scarf', slot: 'neck', at: [3, 10], rows: ['LssssssssS', '.ddddddLs.', '.......Ls.', '.......dd.'], pal: { L: '#F87171', s: '#DC2626', S: '#991B1B', d: '#991B1B' } },
  { id: 'out.bowtie', slot: 'neck', at: [5, 10], rows: ['bb..bb', 'bbkkbb', 'bb..bb'], pal: { b: '#2563EB', k: '#1E3A8A' } },
  { id: 'out.earbuds', slot: 'ears', at: [3, 8], rows: ['w........w', 'w........w'], pal: { w: '#F8FAFC' } },
  { id: 'out.phones', slot: 'ears', at: [3, 5], rows: ['..kkkkkk..', '.k......k.', 'cc......cc', 'cC......cC', 'cc......cc'], pal: { k: '#1F2937', c: '#38BDF8', C: '#0369A1' } },
];

const REGISTRY = new Map<string, WornArt>(WORN_ART.map((w) => [w.id, w]));

/** Tests and later art batches add pieces here. */
export function registerWornArt(arts: readonly WornArt[]): void {
  for (const art of arts) REGISTRY.set(art.id, art);
}

export function wornArt(id: string | null | undefined): WornArt | undefined {
  return id ? REGISTRY.get(id) : undefined;
}

/** A board colour code on KIP's ramp: '@b' '@h' '@s' '@d' are body, light, shade and deep; any other fill is itself.
 * The one copy of this mapping (ruling P30): room items and icons import it from here. */
export function tintOf(c: string, ramp: KipRamp): string {
  return c === '@b' ? ramp.body : c === '@h' ? ramp.light : c === '@s' ? ramp.shade : c === '@d' ? ramp.deep : c;
}

/** The piece as a 16 × 16 fill grid (null is empty), at its place on an upright, resting KIP. */
export function wornLayer(id: string, ramp: KipRamp): (string | null)[][] {
  const grid = Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));
  const art = wornArt(id);
  if (!art) return grid;
  art.rows.forEach((row, j) => [...row].forEach((key, i) => {
    const x = art.at[0] + i, y = art.at[1] + j;
    if (key !== '.' && art.pal[key] && x >= 0 && y >= 0 && x < 16 && y < 16) grid[y]![x] = tintOf(art.pal[key]!, ramp);
  }));
  return grid;
}

/** A worn record from the server or a buddy: ids this build cannot draw, or in the wrong slot, are dropped. */
export function kipWornOf(value: unknown): KipWorn {
  const out: KipWorn = { ...EMPTY_WORN };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const slot of WORN_SLOTS) {
    const id = (value as Record<string, unknown>)[slot];
    if (typeof id === 'string' && wornArt(id)?.slot === slot) out[slot] = id;
  }
  return out;
}

/** Below this size a KIP draws only head and ears pieces (§7 "At small sizes"). */
export const SMALL_KIP_PT = 32;

export function wornForSize(worn: Partial<KipWorn> | undefined, sizePt: number): Partial<KipWorn> {
  if (!worn) return {};
  if (sizePt >= SMALL_KIP_PT) return worn;
  const out: Partial<KipWorn> = {};
  if (worn.head !== undefined) out.head = worn.head;
  if (worn.ears !== undefined) out.ears = worn.ears;
  return out;
}
