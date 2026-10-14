// Rugs (CatFloor.dc.html:113-121) on the floor in perspective: the board's flat 60 × 7 patterns become trapezoids
// with Spec A's slate rug outline (top edge x 40-134 at y 92, bottom x 30-144 at y 106).
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { E, poly, type Rects } from '../paint';

const TOP = 92, BOT = 106;
const xl = (y: number) => 40 - ((y - TOP) * 10) / 14;
const xr = (y: number) => 134 + ((y - TOP) * 10) / 14;
const band = (r: Rects, y0: number, y1: number, c: string) => poly(r, [[xl(y0), y0], [xr(y0), y0], [xr(y1), y1], [xl(y1), y1]], c);
/** A column of the rug from fraction t0 to t1, rows y0 to y1. */
const cell = (r: Rects, t0: number, t1: number, y0: number, y1: number, c: string) => {
  const at = (t: number, y: number) => xl(y) + (xr(y) - xl(y)) * t;
  poly(r, [[at(t0, y0), y0], [at(t1, y0), y0], [at(t1, y1), y1], [at(t0, y1), y1]], c);
};

const rugs: ItemArt[] = [
  { id: 'rug.red', slot: 'rug', draw: () => { const r: Rects = []; band(r, TOP, BOT, '#9A3B3B'); band(r, TOP + 2, TOP + 3, '#7F2D2D'); band(r, BOT - 3, BOT - 2, '#7F2D2D'); return { base: r }; } },
  { id: 'rug.gymmat', slot: 'rug', draw: () => { const r: Rects = []; band(r, TOP, BOT, '#1F2937'); for (const t of [0.25, 0.5, 0.75]) cell(r, t, t + 0.01, TOP, BOT, '#111827'); return { base: r }; } },
  { id: 'rug.checker', slot: 'rug', draw: () => { const r: Rects = []; band(r, TOP, BOT, '#1F2937'); for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) cell(r, i / 12, (i + 1) / 12, TOP + j * 7, TOP + (j + 1) * 7, '#F1F5F9'); return { base: r }; } },
  { id: 'rug.woven', slot: 'rug', draw: () => { const r: Rects = []; E(r, 87, 99, 50, 7, '#C08A5A'); E(r, 87, 99, 44, 5, '#A16207'); E(r, 87, 99, 38, 4, '#C08A5A'); E(r, 87, 99, 24, 2, '#92400E'); return { base: r }; } },
  { id: 'rug.tatami', slot: 'rug', draw: () => { const r: Rects = []; band(r, TOP, BOT, '#C9C08A'); band(r, TOP, TOP + 1, '#3F6212'); band(r, BOT - 1, BOT, '#3F6212'); for (let i = 1; i < 8; i++) cell(r, i / 8, i / 8 + 0.008, TOP + 1, BOT - 1, '#B5AB72'); return { base: r }; } },
];
registerItems(rugs);

/** The board's striped rug (CatFloor.dc.html:77). */
const rugStripe = (a: string, b: string): SpriteRect[] => [[0, 0, 60, 7, a], [0, 1, 60, 1, b], [0, 5, 60, 1, b]];

// The board sprites, verbatim (CatFloor.dc.html:114-119).
registerIcons({
  'rug.slate': rugStripe('#475569', '#334155'),
  'rug.red': rugStripe('#9A3B3B', '#7F2D2D'),
  'rug.gymmat': [[0, 0, 60, 7, '#1F2937'], [15, 0, 1, 7, '#111827'], [30, 0, 1, 7, '#111827'], [45, 0, 1, 7, '#111827'], [6, 3, 1, 1, '#475569'], [22, 2, 1, 1, '#475569'], [38, 4, 1, 1, '#475569'], [52, 2, 1, 1, '#475569']],
  'rug.checker': [[0, 0, 60, 7, '#1F2937'], [0, 0, 5, 4, '#F1F5F9'], [10, 0, 5, 4, '#F1F5F9'], [20, 0, 5, 4, '#F1F5F9'], [30, 0, 5, 4, '#F1F5F9'], [40, 0, 5, 4, '#F1F5F9'], [50, 0, 5, 4, '#F1F5F9'], [5, 4, 5, 3, '#F1F5F9'], [15, 4, 5, 3, '#F1F5F9'], [25, 4, 5, 3, '#F1F5F9'], [35, 4, 5, 3, '#F1F5F9'], [45, 4, 5, 3, '#F1F5F9'], [55, 4, 5, 3, '#F1F5F9']],
  'rug.woven': [[8, 0, 44, 1, '#C08A5A'], [3, 1, 54, 1, '#C08A5A'], [0, 2, 60, 3, '#C08A5A'], [3, 5, 54, 1, '#C08A5A'], [8, 6, 44, 1, '#C08A5A'], [6, 3, 48, 1, '#92400E'], [14, 1, 32, 1, '#A16207'], [14, 5, 32, 1, '#A16207']],
  'rug.tatami': [[0, 0, 60, 7, '#C9C08A'], [0, 0, 60, 1, '#3F6212'], [0, 6, 60, 1, '#3F6212'], [8, 1, 1, 5, '#B5AB72'], [16, 1, 1, 5, '#B5AB72'], [24, 1, 1, 5, '#B5AB72'], [32, 1, 1, 5, '#B5AB72'], [40, 1, 1, 5, '#B5AB72'], [48, 1, 1, 5, '#B5AB72']],
});
