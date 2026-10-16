// Release 6's challenge pieces and trophies (spec 2026-10-15 §4, §10.4; P4 rulings 1-2).
import '../../src/lib/room/iso';
import { catalogueItem } from '../../src/lib/room/catalogue';
import { iconRectsFor } from '../../src/lib/room/icons';
import { isoArtOf } from '../../src/lib/room/iso/art';
import { ITEM_NAMES, spokenName, unlockLine, unlockSpoken } from '../../src/lib/room/roomCopy';

const PIECES = ['lamp.harvest', 'plant.ivy', 'lamp.moon', 'item.organiser', 'corner.acorn', 'corner.can', 'corner.owl', 'item.goldpen'];

it('every challenge piece ships with a name, an icon and iso art', () => {
  for (const id of PIECES) {
    expect([id, catalogueItem(id)?.release]).toEqual([id, 6]);
    expect([id, typeof ITEM_NAMES[id]]).toEqual([id, 'string']);
    expect([id, iconRectsFor(id, 'coral').length > 0]).toEqual([id, true]);
    expect([id, !!isoArtOf(id)]).toEqual([id, true]);
  }
});

it('trophies glow and read as a challenge trophy, never as a shop piece', () => {
  for (const id of ['corner.acorn', 'corner.can', 'corner.owl', 'item.goldpen']) {
    expect(catalogueItem(id)?.emissive).toBe(true);
    expect(catalogueItem(id)?.price).toBeUndefined();
    expect(unlockLine(catalogueItem(id)!.unlock)).toBe('A weekly challenge trophy');
  }
  expect(catalogueItem('lamp.harvest')?.shop).toBe('theme');
});

it('speaks every challenge piece and the trophy line without a "·" (PF4-F15)', () => {
  for (const id of PIECES) expect([id, spokenName(id).includes('·')]).toEqual([id, false]);
  expect(unlockSpoken({ kind: 'prize' })).toBe('A weekly challenge trophy');
});
