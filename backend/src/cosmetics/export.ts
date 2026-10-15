// The app's copy of the catalogue (spec §1 "Where it lives"): ids, slots, flags, set membership and unlock rules,
// no art, releases in SHIPPED_RELEASES only, plus the starter and set layouts and a copy of the placement rules
// (free-build spec §12). tests/cosmetics/export.test.ts and tests/room/copy.test.ts fail when either file is stale.
import fs from 'fs';
import path from 'path';
import {
  COSMETICS_CATALOGUE_VERSION, COSMETIC_ITEMS, COSMETIC_SETS, SHIPPED_RELEASES, STARTER_ROOM,
  type CosmeticItem, type CosmeticSet, type RoomSlot,
} from './catalogue';
import { familyDef } from '../achievements/catalogue';
import { layoutFromSlots, starterLayout } from '../room/convert';
import type { RoomLayout } from '../room/geometry';
import { TIER_GATES } from '../room/tiers';

export interface CatalogueExport {
  version: number;
  releases: number[];
  starterRoom: Record<RoomSlot, string | null>;
  starterLayout: RoomLayout;
  items: CosmeticItem[];
  sets: Array<CosmeticSet & { layout: RoomLayout }>;
  tierGates: Record<'2' | '3', { price: number; family: string; level: number; threshold: number }>;
}

export const MOBILE_CATALOGUE_PATH = path.join(__dirname, '../../../mobile/src/lib/room/catalogue.json');
export const MOBILE_GEOMETRY_PATH = path.join(__dirname, '../../../mobile/src/lib/room/iso/geometry.ts');
const GEOMETRY_PATH = path.join(__dirname, '../room/geometry.ts');
const GEOMETRY_BANNER = '// GENERATED from backend/src/room/geometry.ts by backend/scripts/export-cosmetics.ts. Do not edit.\n';

/** The app's copy of the placement rules: the banner, then the backend file verbatim. */
export function geometryCopy(): string {
  return GEOMETRY_BANNER + fs.readFileSync(GEOMETRY_PATH, 'utf8');
}

export function exportCatalogue(shipped: ReadonlySet<number> = SHIPPED_RELEASES): CatalogueExport {
  const sets = COSMETIC_SETS.filter((s) => shipped.has(s.release));
  const setIds = new Set<string>(sets.map((s) => s.id));
  return {
    version: COSMETICS_CATALOGUE_VERSION,
    releases: [...shipped].sort((a, b) => a - b),
    starterRoom: { ...STARTER_ROOM },
    starterLayout: starterLayout(),
    // An item lists only shipped sets (Spec B Task 2 minor): the app never sees a set it cannot show.
    items: COSMETIC_ITEMS.filter((i) => shipped.has(i.release)).map(({ sets: itemSets, ...rest }) => {
      const kept = (itemSets ?? []).filter((s) => setIds.has(s));
      return kept.length ? { ...rest, sets: kept } : rest;
    }),
    // Each set ships its own iso layout, what Apply set places (spec §5.5, plan ruling 21).
    sets: sets.map((s) => ({ ...s, layout: layoutFromSlots(s.room) })),
    // The room sizes' gates (ruling 37): one source for the server's check and the app's Room sizes screen.
    tierGates: {
      2: { ...TIER_GATES[2], threshold: familyDef(TIER_GATES[2].family).thresholds[TIER_GATES[2].level - 1]! },
      3: { ...TIER_GATES[3], threshold: familyDef(TIER_GATES[3].family).thresholds[TIER_GATES[3].level - 1]! },
    },
  };
}

export function serialiseExport(e: CatalogueExport): string {
  return `${JSON.stringify(e, null, 2)}\n`;
}
