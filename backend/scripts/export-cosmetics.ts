/// <reference types="node" />
// Writes mobile/src/lib/room/catalogue.json from the backend catalogue (spec 2026-10-14 KIP's room §1).
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts
import fs from 'fs';
import { MOBILE_CATALOGUE_PATH, exportCatalogue, serialiseExport } from '../src/cosmetics/export';

if (require.main === module) {
  fs.writeFileSync(MOBILE_CATALOGUE_PATH, serialiseExport(exportCatalogue()));
  console.log(`wrote ${exportCatalogue().items.length} items to the app's catalogue`);
}
