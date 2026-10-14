import { checkSlotArt, CTX_DAY } from '../../jest-mocks/roomArtChecks';
import { drawKipLayer, drawRoomStatic, kipSeatFor, SEATS } from '../../src/lib/room/draw';
import { boundsOf, boxContains, THUMB_BOX } from '../../src/lib/room/grid';
import { itemArt } from '../../src/lib/room/items';
import { LAPTOP_GLASS } from '../../src/lib/room/items/desk';
import { STARTER_LOADOUT, EMPTY_WORN } from '../../src/lib/room/loadout';

it.each(['shelf', 'desk', 'desk_item', 'plant', 'lamp', 'corner', 'rug', 'pet'] as const)('every shipped %s piece has art, an icon and the right flags', (slot) => {
  checkSlotArt(slot, { sets: false });
});

it('every desk draws the desk and chair, seats KIP on the standard seat, and keeps KIP and its screen in the thumbnail', () => {
  for (const desk of ['desk.monitor', 'desk.notebook', 'desk.laptop']) {
    expect(kipSeatFor({ ...STARTER_LOADOUT, desk })).toEqual(SEATS.standard);
    expect(itemArt(desk)!.style).toBe('standard');
  }
  expect(boxContains(THUMB_BOX, LAPTOP_GLASS)).toBe(true);
});

it('the laptop shows the stage on its own glass: lines, dots, then the chart', () => {
  const frames = (screen: 'lines' | 'dots' | 'chart') => JSON.stringify(itemArt('desk.laptop')!.draw({ ...CTX_DAY, screen }).frames);
  expect(new Set([frames('lines'), frames('dots'), frames('chart')]).size).toBe(3);
  for (const f of itemArt('desk.laptop')!.draw({ ...CTX_DAY, screen: 'chart' }).frames!) {
    if (f.length) expect(boxContains(LAPTOP_GLASS, boundsOf(f)!)).toBe(true);
  }
});

it('a desk piece never covers KIP\'s seat with its base, so KIP stays in front of the desk', () => {
  const kip = boundsOf(drawKipLayer({ colour: 'coral', pose: 'rest', mood: 'idle', worn: EMPTY_WORN }, SEATS.standard))!;
  for (const id of ['item.sticky', 'item.bottle', 'item.pills', 'item.shaker', 'item.stand', 'item.controller']) {
    const b = boundsOf(itemArt(id)!.draw(CTX_DAY).base!)!;
    expect({ id, clear: b.x + b.w <= kip.x || b.y + b.h <= kip.y }).toEqual({ id, clear: true });
  }
});

it('a full release-1 room draws without throwing, day and night', () => {
  const loadout = { ...STARTER_LOADOUT, shelf: 'shelf.globe', desk: 'desk.laptop', desk_item: 'item.stand', plant: 'plant.monstera', lamp: 'lamp.kiplamp', corner: 'corner.bag', rug: 'rug.woven', pet: 'pet.bed' };
  for (const night of [false, true]) expect(drawRoomStatic({ loadout, weather: 'mostly', night, colour: 'lilac' }).base.length).toBeGreaterThan(100);
});
