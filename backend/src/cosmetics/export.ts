// The app's copy of the catalogue (spec §1 "Where it lives"): ids, slots, flags, set membership and unlock rules,
// no art, releases in SHIPPED_RELEASES only. tests/cosmetics/export.test.ts fails when the file is stale.
import path from 'path';
import {
  COSMETICS_CATALOGUE_VERSION, COSMETIC_ITEMS, COSMETIC_SETS, SHIPPED_RELEASES, STARTER_ROOM,
  type CosmeticItem, type CosmeticSet, type RoomSlot,
} from './catalogue';

export interface CatalogueExport {
  version: number;
  releases: number[];
  starterRoom: Record<RoomSlot, string | null>;
  items: CosmeticItem[];
  sets: CosmeticSet[];
}

export const MOBILE_CATALOGUE_PATH = path.join(__dirname, '../../../mobile/src/lib/room/catalogue.json');

export function exportCatalogue(shipped: ReadonlySet<number> = SHIPPED_RELEASES): CatalogueExport {
  const sets = COSMETIC_SETS.filter((s) => shipped.has(s.release));
  const setIds = new Set<string>(sets.map((s) => s.id));
  return {
    version: COSMETICS_CATALOGUE_VERSION,
    releases: [...shipped].sort((a, b) => a - b),
    starterRoom: { ...STARTER_ROOM },
    // An item lists only shipped sets (Spec B Task 2 minor): the app never sees a set it cannot show.
    items: COSMETIC_ITEMS.filter((i) => shipped.has(i.release)).map(({ sets: itemSets, ...rest }) => {
      const kept = (itemSets ?? []).filter((s) => setIds.has(s));
      return kept.length ? { ...rest, sets: kept } : rest;
    }),
    sets,
  };
}

export function serialiseExport(e: CatalogueExport): string {
  return `${JSON.stringify(e, null, 2)}\n`;
}
