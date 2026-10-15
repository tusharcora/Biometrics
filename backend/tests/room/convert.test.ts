import { COSMETIC_ITEMS, OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_ROOM, isShipped, type RoomSlot } from '../../src/cosmetics/catalogue';
import { layoutFromSlots, slotsFromLayout, starterLayout } from '../../src/room/convert';
import { validateLayout } from '../../src/room/geometry';
import { deps } from './helpers';

const STYLE: Partial<Record<RoomSlot, 'wallpaper' | 'floor' | 'window'>> = { wallpaper: 'wallpaper', floor: 'floor', window: 'window' };

it('converts every shipped item in every slot to a valid iso room (spec §2.4, §16)', () => {
  for (const slot of ROOM_SLOTS) {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === slot && isShipped(i) && i.release !== 3)) {
      const layout = layoutFromSlots({ ...STARTER_ROOM, [slot]: item.id });
      const tag = { slot, id: item.id };
      expect({ ...tag, failure: validateLayout(layout, 1, deps) }).toEqual({ ...tag, failure: null });
      const placed = STYLE[slot] ? layout.styles[STYLE[slot]!] : layout.pieces.find((p) => p.item === item.id)?.item;
      expect({ ...tag, placed }).toEqual({ ...tag, placed: item.id });
    }
  }
});

it('puts each slot where isox.py\'s standard room has it', () => {
  const room = { ...STARTER_ROOM, art: 'art.mountain', corner: 'corner.floorlamp', pet: 'pet.bed' };
  expect(layoutFromSlots(room)).toEqual({
    v: 1,
    styles: { wallpaper: 'wall.plain', floor: 'floor.oakDark', window: 'win.plain' },
    pieces: [
      { id: 'desk', item: 'desk.monitor', layer: 'floor', x: 2, y: 0, facing: 'L', mirror: false },
      { id: 'lamp', item: 'lamp.amber', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 0 },
      { id: 'deskitem', item: 'item.mug', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 2 },
      { id: 'plank', item: 'shelf.plank', layer: 'wallR', x: 6, y: 10, facing: 'L', mirror: false },
      { id: 'shelf', item: 'shelf.books', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'plank', spot: 0 },
      { id: 'art', item: 'art.mountain', layer: 'wallR', x: 2, y: 9, facing: 'L', mirror: false },
      { id: 'plant', item: 'plant.fern', layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false },
      { id: 'corner', item: 'corner.floorlamp', layer: 'floor', x: 5, y: 0, facing: 'L', mirror: false },
      { id: 'rug', item: 'rug.slate', layer: 'floor', x: 1, y: 2, facing: 'L', mirror: false },
      { id: 'pet', item: 'pet.bed', layer: 'floor', x: 4, y: 5, facing: 'L', mirror: false },
    ],
  });
});

it('places nothing for an empty slot, and hangs a lamp that cannot stand on a desk on the left wall (ruling 7)', () => {
  const ids = layoutFromSlots({ ...STARTER_ROOM, art: null, corner: null, pet: null }).pieces.map((p) => p.id);
  expect(ids.filter((id) => ['art', 'corner', 'pet'].includes(id))).toEqual([]);
  const garland = layoutFromSlots({ ...STARTER_ROOM, lamp: 'set.cottage.lamp' }).pieces.find((p) => p.id === 'lamp');
  expect(garland).toEqual({ id: 'lamp', item: 'set.cottage.lamp', layer: 'wallL', x: 0, y: 14, facing: 'L', mirror: false });
});

it('the starter layout is C7\'s: 7 placements, the books on a plank, no calendar (spec §11.1)', () => {
  const l = starterLayout();
  expect(l.pieces.map((p) => p.item).sort()).toEqual(['desk.monitor', 'item.mug', 'lamp.amber', 'plant.fern', 'rug.slate', 'shelf.books', 'shelf.plank']);
  expect(starterLayout()).not.toBe(l); // a fresh copy each call
});

it('derives a slot room back from a layout for dev builds (spec §2.4, until P2)', () => {
  const room = { ...STARTER_ROOM, art: 'art.mountain', corner: 'corner.floorlamp', pet: 'pet.bed', rug: 'rug.red' };
  expect(slotsFromLayout(layoutFromSlots(room))).toEqual(room);
  const bare = slotsFromLayout({ ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id === 'desk') });
  for (const slot of ROOM_SLOTS) if (bare[slot] === null) expect(OPTIONAL_ROOM_SLOTS.has(slot)).toBe(true);
});
