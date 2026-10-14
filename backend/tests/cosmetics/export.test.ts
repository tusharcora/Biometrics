import fs from 'fs';
import { COSMETICS_RELEASE, COSMETIC_ITEMS } from '../../src/cosmetics/catalogue';
import { MOBILE_CATALOGUE_PATH, exportCatalogue, serialiseExport } from '../../src/cosmetics/export';

it('the app\'s copy is current: run scripts/export-cosmetics.ts after any catalogue change', () => {
  expect(fs.readFileSync(MOBILE_CATALOGUE_PATH, 'utf8')).toBe(serialiseExport(exportCatalogue()));
});

it('ships only items and sets the app can draw (release <= COSMETICS_RELEASE)', () => {
  const e = exportCatalogue();
  expect(e.items.every((i) => i.release <= COSMETICS_RELEASE)).toBe(true);
  expect(e.sets.every((s) => s.release <= COSMETICS_RELEASE)).toBe(true);
  const shipped = new Set(e.items.map((i) => i.id));
  for (const set of e.sets) for (const id of [...Object.values(set.room), ...Object.values(set.worn)]) expect(shipped.has(id!)).toBe(true);
});

it('ships every item grantCosmetics can grant', () => {
  const shipped = new Set(exportCatalogue().items.map((i) => i.id));
  const grantable = COSMETIC_ITEMS.filter((i) => i.release <= COSMETICS_RELEASE && !i.retired && i.unlock.kind !== 'starter');
  expect(grantable.filter((i) => !shipped.has(i.id)).map((i) => i.id)).toEqual([]);
});

it('a release-2 export would add the other five sets', () => {
  expect(exportCatalogue(2).sets).toHaveLength(6);
  expect(exportCatalogue(2).items.length).toBeGreaterThan(exportCatalogue(1).items.length);
});
