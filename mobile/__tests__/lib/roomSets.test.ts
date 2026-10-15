import { checkSlotArt } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueSet } from '../../src/lib/room/catalogue';
import { drawRoom } from '../../src/lib/room/draw';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { isoArtOf } from '../../src/lib/room/iso/art';
import '../../src/lib/room/iso';
import { SET_SWATCHES } from '../../src/lib/room/art';
import { wornArt } from '../../src/lib/kip/wornArt';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { ROOM_SLOTS } from '../../src/lib/room/slots';

it('every catalogue id the app ships has art and an icon (a release can never offer an undrawable piece)', () => {
  // Release 3's structural pieces (the plank, the welcome lantern) have iso art only.
  const missing = CATALOGUE.items.filter((i) => !(itemArt(i.id) ?? wornArt(i.id) ?? isoArtOf(i.id)) || !itemIcon(i.id)?.length).map((i) => i.id);
  expect(missing).toEqual([]);
  for (const slot of ROOM_SLOTS) checkSlotArt(slot);
});

it.each(CATALOGUE.sets.map((s) => s.id))('the %s set draws deterministically, day and night, with four swatches', (id) => {
  const set = catalogueSet(id)!;
  expect(SET_SWATCHES[id]).toHaveLength(4);
  for (const night of [false, true]) {
    const input = { loadout: set.room, weather: 'mostly' as const, night, kip: { colour: 'lime' as const, pose: 'type' as const, mood: 'glance' as const, worn: { ...EMPTY_WORN, ...set.worn } }, screen: 'lines' as const };
    const d = drawRoom(input);
    expect(drawRoom(input)).toEqual(d);
    expect({ base: d.base.length, light: d.light.length, emissive: d.emissive.length, frames: d.frames.map((f) => f.length), kip: d.kip.length })
      .toMatchSnapshot(`${id} ${night ? 'night' : 'day'}`);
  }
});
