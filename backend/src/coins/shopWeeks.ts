// The coin shop's featured set (spec 2026-10-15 §6.6, plan ruling 4): four sets of always-on pieces, one a week,
// turning every Monday by the user's local ISO week. No bundle price: each piece is bought on its own.
export interface ShopWeekSet { id: string; itemIds: readonly string[] }

export const SHOP_WEEKS: readonly ShopWeekSet[] = [
  { id: 'cosyAutumn', itemIds: ['corner.pumpkin', 'item.candle', 'lamp.amber', 'rug.slate', 'plant.fern'] },
  { id: 'greenCorner', itemIds: ['plant.fern', 'plant.cactus', 'plant.monstera', 'plant.snake', 'corner.gnome'] },
  { id: 'deskDay', itemIds: ['item.radio', 'item.mug', 'item.sticky', 'shelf.books', 'shelf.plank'] },
  { id: 'brightNight', itemIds: ['art.neonheart', 'corner.cone', 'item.candle', 'shelf.minicactus', 'corner.floorlamp'] },
];

const DAY_MS = 86_400_000;

/** The day number (days since 1970-01-01) of an ISO week's Monday: week 1 holds 4 January. */
function mondayDay(year: number, week: number): number {
  const jan4 = Date.UTC(year, 0, 4) / DAY_MS;
  const jan4Weekday = (new Date(jan4 * DAY_MS).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  return jan4 - jan4Weekday + (week - 1) * 7;
}

/**
 * '2026-W43' → that week's set: floor(its Monday's day number / 7) mod 4 (ruling T6-FIX), a count of whole weeks, so
 * each Monday moves exactly one set on, across a 52- or a 53-week year alike. A malformed week reads as the first set.
 */
export function weekSet(week: string): ShopWeekSet {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  const n = m ? Math.floor(mondayDay(Number(m[1]), Number(m[2])) / 7) : 0;
  return SHOP_WEEKS[((n % SHOP_WEEKS.length) + SHOP_WEEKS.length) % SHOP_WEEKS.length]!;
}
