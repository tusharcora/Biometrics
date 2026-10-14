import { CATALOGUE, catalogueItem, catalogueItemsFor, catalogueSet, isWornSlot } from '../../src/lib/room/catalogue';
import { STARTER_LOADOUT } from '../../src/lib/room/loadout';
import { ROOM_SLOTS, WORN_SLOTS } from '../../src/lib/room/slots';

it('starts every room from the server\'s starter loadout (one source, ruling 24)', () => {
  expect(STARTER_LOADOUT).toEqual(CATALOGUE.starterRoom);
});

it('holds release 1: 87 items and the Cottage set, every piece known', () => {
  expect([CATALOGUE.release, CATALOGUE.items.length, CATALOGUE.sets.map((s) => s.id)]).toEqual([1, 87, ['cottage']]);
  for (const item of CATALOGUE.items) expect([...ROOM_SLOTS, ...WORN_SLOTS]).toContain(item.slot);
  const cottage = catalogueSet('cottage')!;
  for (const id of [...Object.values(cottage.room), ...Object.values(cottage.worn)]) expect(catalogueItem(id!)).toBeDefined();
});

it('lists a slot\'s items in catalogue order and tells worn slots apart', () => {
  expect(catalogueItemsFor('pet').map((i) => i.id)).toEqual(['pet.bed', 'set.cottage.pet']);
  expect([isWornSlot('ears'), isWornSlot('rug')]).toEqual([true, false]);
  expect(catalogueItem('wall.shoji')).toBeUndefined(); // release 2 is not in the app yet
});
