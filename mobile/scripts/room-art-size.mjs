// Spec 2026-10-15 free-build §4: the room's art (the front-on sprites and every iso piece) must add at most 300 KB
// (minified) to the JS bundle. Bundles src/lib/room/iso/index.ts (every piece file, the front-on item files and what
// they import) with esbuild and prints the size. Run by hand before each art batch:  node scripts/room-art-size.mjs
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 300 * 1024;
const result = await build({
  entryPoints: [path.join(root, 'src/lib/room/iso/index.ts')],
  bundle: true, minify: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  loader: { '.json': 'json' },
});
const bytes = result.outputFiles[0].contents.length;
console.log(`room art (front-on sprites and iso pieces): ${(bytes / 1024).toFixed(1)} KB minified (limit ${LIMIT / 1024} KB)`);
process.exit(bytes > LIMIT ? 1 : 0);
