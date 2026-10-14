// Spec 2026-10-14 KIP's room §8: the room's item art must add at most 150 KB (minified) to the JS bundle. Bundles
// src/lib/room/art.ts (every item file and what they import) with esbuild and prints the size. Run by hand before each
// art batch:  node scripts/room-art-size.mjs
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 150 * 1024;
const result = await build({
  entryPoints: [path.join(root, 'src/lib/room/art.ts')],
  bundle: true, minify: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  loader: { '.json': 'json' },
});
const bytes = result.outputFiles[0].contents.length;
console.log(`room item art: ${(bytes / 1024).toFixed(1)} KB minified (limit ${LIMIT / 1024} KB)`);
process.exit(bytes > LIMIT ? 1 : 0);
