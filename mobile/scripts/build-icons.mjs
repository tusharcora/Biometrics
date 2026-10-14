// Writes the app icons from KIP's engine (spec 2026-10-14 KIP Coach §9): `npm run build:icons`, which runs
// `sucrase-node scripts/build-icons.mjs`. sucrase-node's require hook compiles the TypeScript grid module, so the icon
// can never drift from KIP. Run it again after any change to lib/kip/kipArt.ts or lib/kip/iconArt.ts.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const { ICON_FILES, rasterize } = require('../src/lib/kip/iconArt.ts');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const { file, size, grid, scale } of ICON_FILES) {
  const png = new PNG({ width: size, height: size });
  png.data = Buffer.from(rasterize(grid(), size, scale));
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, PNG.sync.write(png, { colorType: 6 }));
  console.log(`${file} ${size}×${size}`);
}
