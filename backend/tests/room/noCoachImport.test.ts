import fs from 'fs';
import path from 'path';

// Spec 2026-10-15 §12: nothing cosmetic reaches the model. The coach never imports the room, cosmetics, coins or
// challenge modules, directly or by a relative path.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

it('no file under src/coach imports cosmetics/, room/, coins/ or challenges/', () => {
  const root = path.join(__dirname, '../../src/coach');
  const IMPORT = /(?:from|require\()\s*['"][^'"]*\/(?:cosmetics|room|coins|challenges)(?:\/[^'"]*)?['"]/;
  const hits = files(root).filter((f) => IMPORT.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  expect(hits).toEqual([]);
});
