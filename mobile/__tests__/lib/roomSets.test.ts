import { checkSlotArt } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueSet, ROOM_SLOTS } from '../../src/lib/room/catalogue';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { isoArtOf } from '../../src/lib/room/iso/art';
import { drawIsoStatic } from '../../src/lib/room/iso/room';
import '../../src/lib/room/iso';
import { SET_SWATCHES } from '../../src/lib/room/art';
import { wornArt } from '../../src/lib/kip/wornArt';

it('every catalogue id the app ships has art and an icon (a release can never offer an undrawable piece)', () => {
  // Release 3's structural pieces (the plank, the welcome lantern) have iso art only.
  const missing = CATALOGUE.items.filter((i) => !(itemArt(i.id) ?? wornArt(i.id) ?? isoArtOf(i.id)) || !itemIcon(i.id)?.length).map((i) => i.id);
  expect(missing).toEqual([]);
  for (const slot of ROOM_SLOTS) checkSlotArt(slot);
});

it.each(CATALOGUE.sets.map((s) => s.id))('the %s set draws its iso layout deterministically, day and night, with four swatches', (id) => {
  const set = catalogueSet(id)!;
  expect(SET_SWATCHES[id]).toHaveLength(4);
  for (const night of [false, true]) {
    const input = { layout: set.layout, tier: 1 as const, weather: 'mostly' as const, night, colour: 'lime' as const };
    const d = drawIsoStatic(input);
    expect(drawIsoStatic(input)).toEqual(d);
    expect({ back: d.back.length, front: d.front.length, light: d.light.length, emissive: d.emissive.length }).toMatchSnapshot(`${id} ${night ? 'night' : 'day'}`);
  }
});
