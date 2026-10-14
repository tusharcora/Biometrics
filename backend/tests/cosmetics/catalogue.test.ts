import { ALL_FAMILIES } from '../../src/achievements/catalogue';
import {
  COSMETICS_RELEASE, COSMETIC_ITEMS, COSMETIC_SETS, OPTIONAL_ROOM_SLOTS, RELEASE_LAUNCHED_AT, ROOM_SLOTS, STARTER_IDS,
  STARTER_ROOM, WORN_SLOTS, cosmeticItem, ruleOf, type CosmeticSlot,
} from '../../src/cosmetics/catalogue';
import fs from 'fs';
import path from 'path';

// backend tsconfig has no resolveJsonModule: read the snapshot as a file.
const everShipped = JSON.parse(fs.readFileSync(path.join(__dirname, 'everShipped.json'), 'utf8')) as string[];

const PREFIX: Record<CosmeticSlot, string> = {
  wallpaper: 'wall', floor: 'floor', art: 'art', window: 'win', shelf: 'shelf', desk: 'desk', desk_item: 'item',
  plant: 'plant', lamp: 'lamp', corner: 'corner', rug: 'rug', pet: 'pet', head: 'out', face: 'out', neck: 'out', ears: 'out',
};
const ids = COSMETIC_ITEMS.map((i) => i.id);
const base = COSMETIC_ITEMS.filter((i) => !i.id.startsWith('set.'));
const count = (slot: CosmeticSlot) => base.filter((i) => i.slot === slot).length;

it('reads the Cat boards\' unlock codes', () => {
  expect(ruleOf('S')).toEqual({ kind: 'starter' });
  expect(ruleOf('SB3')).toEqual({ kind: 'family', family: 'STEADY_BEDTIME', level: 3 });
  expect(ruleOf('ANY4')).toEqual({ kind: 'anyFamily', level: 4 });
  expect(ruleOf('RC12')).toEqual({ kind: 'counter', counter: 'recaps_read', atLeast: 12 });
  expect(ruleOf('CB5')).toEqual({ kind: 'counter', counter: 'buddy_cheers', atLeast: 5 });
  expect(() => ruleOf('XX1')).toThrow();
});

it('has unique, well-formed ids whose prefix matches the slot', () => {
  expect(new Set(ids).size).toBe(ids.length);
  for (const item of COSMETIC_ITEMS) {
    const ok = item.id.startsWith('set.') ? /^set\.[a-zA-Z]+\.[a-z_]+$/.test(item.id) : item.id.startsWith(`${PREFIX[item.slot]}.`);
    expect({ id: item.id, ok }).toEqual({ id: item.id, ok: true });
  }
});

it('never drops or renames an id: every id ever shipped is still here, and every id here is recorded', () => {
  expect(everShipped.filter((id) => !cosmeticItem(id))).toEqual([]);
  expect(ids.filter((id) => !everShipped.includes(id))).toEqual([]);
});

it('holds the 134 base items of the Cat boards, slot by slot', () => {
  expect(base).toHaveLength(134);
  expect([count('wallpaper'), count('floor'), count('art'), count('window'), count('shelf'), count('desk'), count('desk_item'),
    count('plant'), count('lamp'), count('corner'), count('rug'), count('pet')]).toEqual([12, 9, 12, 8, 10, 7, 12, 9, 8, 12, 8, 5]);
  expect([count('head'), count('face'), count('neck'), count('ears')]).toEqual([9, 5, 5, 3]);
});

it('has the 17 starter items, all in release 1, and a starter room of placed starters', () => {
  expect([...STARTER_IDS].sort()).toEqual([
    'art.calendar', 'desk.monitor', 'desk.notebook', 'floor.oakDark', 'item.mug', 'item.sticky', 'lamp.amber', 'out.beanie',
    'out.earbuds', 'plant.cactus', 'plant.fern', 'rug.slate', 'shelf.books', 'shelf.minicactus', 'wall.dots', 'wall.plain', 'win.plain',
  ]);
  for (const id of STARTER_IDS) expect(cosmeticItem(id)!.release).toBe(1);
  for (const slot of ROOM_SLOTS) {
    const id = STARTER_ROOM[slot];
    if (id === null) expect(OPTIONAL_ROOM_SLOTS.has(slot)).toBe(true);
    else expect([slot, cosmeticItem(id)!.slot, STARTER_IDS.includes(id)]).toEqual([slot, slot, true]);
  }
  expect([STARTER_ROOM.corner, STARTER_ROOM.pet]).toEqual([null, null]);
});

it('ships 76 base items and the Cottage set in release 1', () => {
  expect(base.filter((i) => i.release === 1)).toHaveLength(76);
  expect(COSMETIC_SETS.filter((s) => s.release === 1).map((s) => s.id)).toEqual(['cottage']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 1)).toHaveLength(87);
});

it('names real families and levels, and only the counters and thresholds the boards use', () => {
  for (const { unlock } of [...COSMETIC_ITEMS, ...COSMETIC_SETS]) {
    if (unlock.kind === 'family') expect(ALL_FAMILIES).toContain(unlock.family);
    if (unlock.kind === 'family' || unlock.kind === 'anyFamily') expect([1, 2, 3, 4, 5]).toContain(unlock.level);
    if (unlock.kind === 'counter') {
      expect(unlock.counter === 'recaps_read' ? [4, 8, 12] : [5, 10, 15]).toContain(unlock.atLeast);
    }
  }
});

it('keeps flags where they belong: loops on room items only, a seat style on desk items only', () => {
  for (const item of COSMETIC_ITEMS) {
    if (item.frames) expect((ROOM_SLOTS as readonly string[]).includes(item.slot)).toBe(true);
    if (item.style) expect(item.slot).toBe('desk');
  }
});

it('gives each set exactly one piece per room slot, worn pieces in worn slots, and lists the set on every piece', () => {
  expect(COSMETIC_SETS.map((s) => s.id)).toEqual(['cottage', 'japanese', 'homeGym', 'gamerNight', 'stargazer', 'library']);
  for (const set of COSMETIC_SETS) {
    expect(Object.keys(set.room).sort()).toEqual([...ROOM_SLOTS].sort());
    for (const slot of ROOM_SLOTS) expect(cosmeticItem(set.room[slot])!.slot).toBe(slot);
    for (const [slot, id] of Object.entries(set.worn)) {
      expect(WORN_SLOTS).toContain(slot);
      expect(cosmeticItem(id!)!.slot).toBe(slot);
    }
    for (const id of [...Object.values(set.room), ...Object.values(set.worn)]) {
      const item = cosmeticItem(id!)!;
      expect(item.sets ?? []).toContain(set.id);
      // A set never ships before its pieces can be drawn.
      expect(item.release).toBeLessThanOrEqual(set.release);
    }
  }
  const cottage = COSMETIC_SETS[0]!;
  expect([Object.keys(cottage.room).length + Object.keys(cottage.worn).length, cottage.unlock, cottage.style])
    .toEqual([13, { kind: 'counter', counter: 'recaps_read', atLeast: 4 }, 'standard']);
  expect(COSMETIC_SETS.find((s) => s.id === 'japanese')!.style).toBe('low');
  expect(cosmeticItem('set.japanese.desk')!.style).toBe('low');
});

it('has a launch date for every release the app ships', () => {
  for (let r = 1; r <= COSMETICS_RELEASE; r++) expect(RELEASE_LAUNCHED_AT[r as 1]).toBeInstanceOf(Date);
});
