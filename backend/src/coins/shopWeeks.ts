// The coin shop's featured set (spec 2026-10-15 §6.6, plan ruling 4): four sets of always-on pieces, one a week,
// turning every Monday by the user's local ISO week. No bundle price: each piece is bought on its own.
export interface ShopWeekSet { id: string; itemIds: readonly string[] }

export const SHOP_WEEKS: readonly ShopWeekSet[] = [
  { id: 'cosyAutumn', itemIds: ['corner.pumpkin', 'item.candle', 'lamp.amber', 'rug.slate', 'plant.fern'] },
  { id: 'greenCorner', itemIds: ['plant.fern', 'plant.cactus', 'plant.monstera', 'plant.snake', 'corner.gnome'] },
  { id: 'deskDay', itemIds: ['item.radio', 'item.mug', 'item.sticky', 'shelf.books', 'shelf.plank'] },
  { id: 'brightNight', itemIds: ['art.neonheart', 'corner.cone', 'item.candle', 'shelf.minicactus', 'corner.floorlamp'] },
];

/** '2026-W43' → that week's set: (ISO year × 53 + week) mod 4, so each Monday moves one set on. */
export function weekSet(week: string): ShopWeekSet {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  const n = m ? Number(m[1]) * 53 + Number(m[2]) : 0;
  return SHOP_WEEKS[n % SHOP_WEEKS.length]!;
}
