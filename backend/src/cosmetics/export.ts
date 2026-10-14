// The app's copy of the catalogue (spec §1 "Where it lives"): ids, slots, flags, set membership and unlock rules,
// no art, release <= COSMETICS_RELEASE only. tests/cosmetics/export.test.ts fails when the file is stale.
import path from 'path';
import {
  COSMETICS_CATALOGUE_VERSION, COSMETICS_RELEASE, COSMETIC_ITEMS, COSMETIC_SETS, STARTER_ROOM,
  type CosmeticItem, type CosmeticSet, type RoomSlot,
} from './catalogue';

export interface CatalogueExport {
  version: number;
  release: number;
  starterRoom: Record<RoomSlot, string | null>;
  items: CosmeticItem[];
  sets: CosmeticSet[];
}

export const MOBILE_CATALOGUE_PATH = path.join(__dirname, '../../../mobile/src/lib/room/catalogue.json');

export function exportCatalogue(release: number = COSMETICS_RELEASE): CatalogueExport {
  return {
    version: COSMETICS_CATALOGUE_VERSION,
    release,
    starterRoom: { ...STARTER_ROOM },
    items: COSMETIC_ITEMS.filter((i) => i.release <= release),
    sets: COSMETIC_SETS.filter((s) => s.release <= release),
  };
}

export function serialiseExport(e: CatalogueExport): string {
  return `${JSON.stringify(e, null, 2)}\n`;
}
