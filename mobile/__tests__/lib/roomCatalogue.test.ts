import { CATALOGUE, catalogueItem, catalogueItemsFor, catalogueSet, isWornSlot, ROOM_SLOTS, WORN_SLOTS } from '../../src/lib/room/catalogue';
import { starterLayout } from '../../src/lib/room/layout';

it('starts every room from the server\'s starter layout (one source, ruling 24)', () => {
  expect(starterLayout()).toEqual(CATALOGUE.starterLayout);
});

it('holds releases 1, 3 and 4: 95 items and the Cottage set, every piece known', () => {
  expect([CATALOGUE.releases, CATALOGUE.items.length, CATALOGUE.sets.map((s) => s.id)]).toEqual([[1, 3, 4], 95, ['cottage']]);
  for (const item of CATALOGUE.items) expect([...ROOM_SLOTS, ...WORN_SLOTS]).toContain(item.slot);
  const cottage = catalogueSet('cottage')!;
  for (const id of [...Object.values(cottage.room), ...Object.values(cottage.worn)]) expect(catalogueItem(id!)).toBeDefined();
});

it('lists a slot\'s items in catalogue order and tells worn slots apart', () => {
  expect(catalogueItemsFor('pet').map((i) => i.id)).toEqual(['pet.bed', 'set.cottage.pet']);
  expect([isWornSlot('ears'), isWornSlot('rug')]).toEqual([true, false]);
  expect(catalogueItem('wall.shoji')).toBeUndefined(); // release 2 is not in the app yet
});

it('carries the room sizes\' gates from the server (plan ruling 37)', () => {
  expect(CATALOGUE.tierGates).toEqual({
    2: { price: 600, family: 'CHECK_IN', level: 2, threshold: 14 },
    3: { price: 1500, family: 'SLEEP_GOAL', level: 3, threshold: 14 },
  });
});
