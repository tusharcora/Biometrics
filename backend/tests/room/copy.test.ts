import fs from 'fs';
import { MOBILE_GEOMETRY_PATH, geometryCopy } from '../../src/cosmetics/export';

it('the app\'s copy of the placement rules is current: run scripts/export-cosmetics.ts after any change (spec §12)', () => {
  expect(fs.readFileSync(MOBILE_GEOMETRY_PATH, 'utf8')).toBe(geometryCopy());
});

it('the rules file imports nothing, so the copy compiles in the app', () => {
  expect(geometryCopy()).not.toMatch(/^\s*import\s/m);
});
