import fs from 'fs';
import { COSMETIC_ITEMS, isShipped } from '../../src/cosmetics/catalogue';
import { MOBILE_CATALOGUE_PATH, exportCatalogue, serialiseExport } from '../../src/cosmetics/export';

it('the app\'s copy is current: run scripts/export-cosmetics.ts after any catalogue change', () => {
  expect(fs.readFileSync(MOBILE_CATALOGUE_PATH, 'utf8')).toBe(serialiseExport(exportCatalogue()));
});

it('ships only the shipped releases, and every set id an item names is a shipped set', () => {
  const e = exportCatalogue();
  expect(e.releases).toEqual([1, 3]);
  expect(e.items.every((i) => isShipped(i))).toBe(true);
  expect(e.sets.every((s) => isShipped(s))).toBe(true);
  const shipped = new Set(e.items.map((i) => i.id));
  for (const set of e.sets) for (const id of [...Object.values(set.room), ...Object.values(set.worn)]) expect(shipped.has(id!)).toBe(true);
  const setIds = new Set(e.sets.map((s) => s.id));
  for (const item of e.items) for (const s of item.sets ?? []) expect({ id: item.id, s, shipped: setIds.has(s) }).toEqual({ id: item.id, s, shipped: true });
  expect(e.items.find((i) => i.id === 'plant.snake')!.sets).toBeUndefined(); // homeGym and library are release 2
});

it('ships every item grantCosmetics can grant', () => {
  const shipped = new Set(exportCatalogue().items.map((i) => i.id));
  const grantable = COSMETIC_ITEMS.filter((i) => isShipped(i) && !i.retired && i.unlock.kind !== 'starter');
  expect(grantable.filter((i) => !shipped.has(i.id)).map((i) => i.id)).toEqual([]);
});

it('a release-2 export would add the other five sets', () => {
  const all = exportCatalogue(new Set([1, 2, 3]));
  expect(all.sets).toHaveLength(6);
  expect(all.items.length).toBeGreaterThan(exportCatalogue().items.length);
});
