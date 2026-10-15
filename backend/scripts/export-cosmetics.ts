/// <reference types="node" />
// Writes mobile/src/lib/room/catalogue.json from the backend catalogue (spec 2026-10-14 KIP's room §1), and
// mobile/src/lib/room/iso/geometry.ts from backend/src/room/geometry.ts (spec 2026-10-15 §12).
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts
import fs from 'fs';
import path from 'path';
import { MOBILE_CATALOGUE_PATH, MOBILE_GEOMETRY_PATH, exportCatalogue, geometryCopy, serialiseExport } from '../src/cosmetics/export';

if (require.main === module) {
  fs.writeFileSync(MOBILE_CATALOGUE_PATH, serialiseExport(exportCatalogue()));
  fs.mkdirSync(path.dirname(MOBILE_GEOMETRY_PATH), { recursive: true });
  fs.writeFileSync(MOBILE_GEOMETRY_PATH, geometryCopy());
  console.log(`wrote ${exportCatalogue().items.length} items and the placement rules to the app`);
}
