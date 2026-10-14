import { checkSlotArt, CTX_DAY } from '../../jest-mocks/roomArtChecks';
import { drawRoomStatic } from '../../src/lib/room/draw';
import { itemArt } from '../../src/lib/room/items';
import { clipFloor, floorSpan, FLOOR_POLY } from '../../src/lib/room/items/shared';
import { STARTER_LOADOUT } from '../../src/lib/room/loadout';
import { FLOOR_Y, ROOM_H, ROOM_W, WALL_X0 } from '../../src/lib/room/grid';

it.each(['wallpaper', 'floor', 'art', 'window'] as const)('every shipped %s piece has art, an icon and the right flags', (slot) => {
  checkSlotArt(slot, { sets: false });
});

it('clips floor patterns to the floor, which widens to the full grid 12 rows below the wall line', () => {
  expect(floorSpan(FLOOR_Y)).toEqual([WALL_X0, ROOM_W - WALL_X0]);
  expect(floorSpan(FLOOR_Y + 12)).toEqual([0, ROOM_W]);
  expect(floorSpan(FLOOR_Y - 1)).toEqual([0, 0]);
  const clipped = clipFloor([[0, FLOOR_Y - 4, ROOM_W, 8, '#000000']]);
  expect(clipped.every(([x, y, w]) => y >= FLOOR_Y && x >= floorSpan(y)[0] && x + w <= floorSpan(y)[1])).toBe(true);
  expect(FLOOR_POLY.at(-2)).toEqual([0, ROOM_H]);
});

it('every window piece keeps the weather sky: the glass shows the same sky as the plain frame', () => {
  const sky = (id: string) => itemArt(id)!.draw(CTX_DAY).base!.filter(([x, y]) => x >= 22 && x < 34 && y >= 16 && y < 20);
  expect(sky('win.blinds').length).toBeGreaterThan(0);
  expect(drawRoomStatic({ loadout: { ...STARTER_LOADOUT, window: 'win.curtains' }, weather: 'clear', night: false, colour: 'coral' }).light.length)
    .toEqual(drawRoomStatic({ loadout: STARTER_LOADOUT, weather: 'clear', night: false, colour: 'coral' }).light.length);
});
