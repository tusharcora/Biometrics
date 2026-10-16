import { ALL_FAMILIES } from '../../src/achievements/catalogue';
import {
  COSMETIC_ITEMS, COSMETIC_SETS, OPTIONAL_ROOM_SLOTS, PRICES, RELEASE_LAUNCHED_AT, ROOM_SLOTS, SHIPPED_RELEASES, STARTER_IDS,
  STARTER_ROOM, WORN_SLOTS, cosmeticItem, isShipped, ruleOf, type CosmeticSet, type CosmeticSlot,
} from '../../src/cosmetics/catalogue';
import { layoutFromSlots } from '../../src/room/convert';
import { effectPieces, effectSlotsFor } from '../../src/room/geometry';
import fs from 'fs';
import path from 'path';

// backend tsconfig has no resolveJsonModule: read the snapshot as a file.
const everShipped = JSON.parse(fs.readFileSync(path.join(__dirname, 'everShipped.json'), 'utf8')) as string[];

const PREFIX: Record<CosmeticSlot, string> = {
  wallpaper: 'wall', floor: 'floor', art: 'art', window: 'win', shelf: 'shelf', desk: 'desk', desk_item: 'item',
  plant: 'plant', lamp: 'lamp', corner: 'corner', rug: 'rug', pet: 'pet', head: 'out', face: 'out', neck: 'out', ears: 'out',
};
const ids = COSMETIC_ITEMS.map((i) => i.id);
const base = COSMETIC_ITEMS.filter((i) => !i.id.startsWith('set.') && i.release <= 2);
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

it('has the 20 starter items, all shipped, and a starter room of placed starters', () => {
  expect([...STARTER_IDS].sort()).toEqual([
    'art.calendar', 'desk.monitor', 'desk.notebook', 'floor.oakDark', 'item.mug', 'item.sticky', 'lamp.amber', 'lamp.welcome',
    'out.beanie', 'out.earbuds', 'plant.cactus', 'plant.fern', 'rug.slate', 'shelf.awards', 'shelf.books', 'shelf.minicactus', 'shelf.plank',
    'wall.dots', 'wall.plain', 'win.plain',
  ]);
  for (const id of STARTER_IDS) expect(isShipped(cosmeticItem(id)!)).toBe(true);
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

it('ships releases 1, 3, 4 and 5, each with a launch date (spec §2.1 Releases, P3 plan ruling 1)', () => {
  expect([...SHIPPED_RELEASES].sort()).toEqual([1, 3, 4, 5]);
  for (const r of SHIPPED_RELEASES) expect(RELEASE_LAUNCHED_AT[r as 1 | 3 | 4 | 5]).toBeInstanceOf(Date);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 3).map((i) => i.id).sort()).toEqual(['lamp.welcome', 'shelf.plank']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 4).map((i) => i.id).sort())
    .toEqual(['art.neonheart', 'corner.cone', 'corner.gnome', 'corner.pumpkin', 'item.candle', 'item.radio']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 5).map((i) => i.id).sort()).toEqual(['pet.tabby', 'shelf.awards']);
});

it('gives the first set of effects to their pieces, and to no other (spec §8.2, P3 rulings 2-3)', () => {
  const effects = Object.fromEntries(COSMETIC_ITEMS.filter((i) => i.iso?.effect).map((i) => [i.id, i.iso!.effect]));
  expect(effects).toEqual({
    'corner.floorlamp': 'light', 'lamp.lava': 'light', 'item.radio': 'sound', 'pet.tabby': 'wander', 'pet.cat': 'wander',
    'art.clock': 'clock', 'item.duck': 'tap', 'shelf.awards': 'awards',
  });
  expect(cosmeticItem('pet.tabby')).toMatchObject({ slot: 'pet', unlock: { kind: 'shop' }, price: 180, frames: 3, iso: { layers: ['floor'], foot: [1, 1], facings: 1 } });
  expect(cosmeticItem('shelf.awards')).toMatchObject({ slot: 'shelf', unlock: { kind: 'starter' }, iso: { layers: ['wall'], wall: [8, 3], facings: 1 } });
  expect(cosmeticItem('shelf.awards')!.price).toBeUndefined(); // ruling 2: not sold
  expect(cosmeticItem('shelf.trophyB')!.iso!.effect).toBeUndefined(); // stays plain decor (§8.2)
  expect(cosmeticItem('pet.bed')!.iso!.effect).toBeUndefined(); // the cat's bed has no effect of its own
});

// The set guard, shared by the real sets and its self-test: how many effect pieces a set's room places, how many it
// names, and whether they fit the starter room's slots (T8-CARRY, T9-CARRY).
const everyItem = { isoOf: (id: string) => cosmeticItem(id)?.iso };
function setEffects(room: CosmeticSet['room']): { placed: number; named: number; fits: boolean } {
  const placed = effectPieces(layoutFromSlots(room), everyItem).length;
  const named = Object.values(room).filter((id) => cosmeticItem(id)?.iso?.effect).length;
  return { placed, named, fits: placed <= effectSlotsFor(1) };
}

it('every set\'s effect pieces fit the starter room\'s 3 slots, so Apply set never says the effects are full (spec §8.1, T8-CARRY)', () => {
  // Every item, shipped or not: a set that ships later is held to the same rule.
  expect(effectSlotsFor(1)).toBe(3);
  for (const set of COSMETIC_SETS) {
    const { placed, named, fits } = setEffects(set.room);
    expect([set.id, fits]).toEqual([set.id, true]);
    // The layout holds every effect piece the set names: none drops out of the count.
    expect(placed).toBe(named);
  }
});

it('the set guard catches a made-up set with one effect piece too many (T9-CARRY self-test)', () => {
  const over = { ...COSMETIC_SETS[0]!.room, desk_item: 'item.radio', art: 'art.clock', corner: 'corner.floorlamp', pet: 'pet.tabby' };
  expect(setEffects(over)).toEqual({ placed: 4, named: 4, fits: false });
  expect(4).toBeGreaterThan(effectSlotsFor(1));
});

it('reads the coin-shop code: a shop piece is only ever bought (plan ruling 2)', () => {
  expect(ruleOf('C')).toEqual({ kind: 'shop' });
  for (const item of COSMETIC_ITEMS.filter((i) => i.release === 4)) {
    expect({ id: item.id, unlock: item.unlock, priced: typeof item.price, iso: !!item.iso }).toEqual({ id: item.id, unlock: { kind: 'shop' }, priced: 'number', iso: true });
  }
});

it('prices pieces 25 to 200 coins, always in the shop, never a desk or the welcome lantern (spec §6.4, §6.5, rulings 3-4)', () => {
  for (const item of COSMETIC_ITEMS.filter((i) => i.price !== undefined)) {
    expect({ id: item.id, ok: item.price! >= 25 && item.price! <= 200 && item.shop === 'always' && !!item.iso }).toEqual({ id: item.id, ok: true });
  }
  for (const id of ['desk.monitor', 'desk.notebook', 'desk.laptop', 'set.cottage.desk', 'lamp.welcome']) expect(cosmeticItem(id)!.price).toBeUndefined();
  const price = (id: string) => cosmeticItem(id)!.price;
  expect(['item.radio', 'corner.gnome', 'corner.cone', 'corner.pumpkin', 'item.candle', 'art.neonheart'].map(price)).toEqual([150, 80, 60, 30, 25, 200]);
  expect(['plant.fern', 'corner.floorlamp', 'pet.bed', 'plant.monstera', 'plant.snake'].map(price)).toEqual([40, 120, 140, 140, 100]);
  expect(['lamp.lava', 'item.duck', 'pet.cat'].map(price)).toEqual([120, 40, 180]); // B2: priced, shown when release 2 ships
  expect(price('pet.tabby')).toBe(180);
});

it('prices only real pieces, and every placeable starter but the desks, the welcome lantern and the trophy shelf (P2 ruling 3, P3 ruling 2)', () => {
  expect(Object.keys(PRICES).filter((id) => !cosmeticItem(id))).toEqual([]);
  const unpriced = STARTER_IDS.map((id) => cosmeticItem(id)!)
    .filter((i) => !!i.iso && i.slot !== 'desk' && i.id !== 'lamp.welcome' && i.id !== 'shelf.awards' && i.price === undefined);
  expect(unpriced.map((i) => i.id)).toEqual([]);
  expect(STARTER_IDS.filter((id) => cosmeticItem(id)!.price !== undefined).length).toBeGreaterThan(0);
});

const PLACEABLE = ROOM_SLOTS.filter((s) => s !== 'wallpaper' && s !== 'floor' && s !== 'window');

describe('iso blocks (spec §2.1, §16 Catalogue)', () => {
  it('every placeable item has one; styles and worn items have none', () => {
    for (const item of COSMETIC_ITEMS) {
      const placeable = (PLACEABLE as readonly string[]).includes(item.slot);
      expect({ id: item.id, iso: !!item.iso }).toEqual({ id: item.id, iso: placeable });
    }
  });

  it('footprints and wall sizes are positive whole tiles; on-top pieces are one tile at most and hold nothing', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.iso)) {
      const iso = item.iso!;
      const tag = { id: item.id };
      expect({ ...tag, layers: iso.layers.length > 0 }).toEqual({ ...tag, layers: true });
      for (const n of [...(iso.foot ?? []), ...(iso.wall ?? [])]) expect({ ...tag, ok: Number.isInteger(n) && n > 0 }).toEqual({ ...tag, ok: true });
      if (iso.layers.includes('floor')) expect({ ...tag, foot: !!iso.foot }).toEqual({ ...tag, foot: true });
      if (iso.layers.includes('wall')) expect({ ...tag, wall: !!iso.wall }).toEqual({ ...tag, wall: true });
      if (iso.layers.includes('onTop')) {
        expect({ ...tag, small: !iso.foot || (iso.foot[0] <= 1 && iso.foot[1] <= 1), surface: !!iso.surface }).toEqual({ ...tag, small: true, surface: false });
      }
      if (iso.flat) expect({ ...tag, layers: iso.layers }).toEqual({ ...tag, layers: ['floor'] });
    }
  });

  it('every desk item, shipped or not, is a kipDesk: 3 × 2, a seat on the front row, 3 spots on the desk', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === 'desk')) {
      const iso = item.iso!;
      expect({ id: item.id, kipDesk: iso.kipDesk, foot: iso.foot, seat: iso.seat, spots: iso.surface?.spots.length, facings: iso.facings })
        .toEqual({ id: item.id, kipDesk: true, foot: [3, 2], seat: [1, 1], spots: 3, facings: 2 });
    }
    expect(COSMETIC_ITEMS.filter((i) => i.iso?.kipDesk).every((i) => i.slot === 'desk')).toBe(true);
  });

  it('spots lie inside their piece: the footprint on the floor, the first half tile off the wall', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.iso?.surface)) {
      const iso = item.iso!;
      const [w, d] = iso.foot ?? [iso.wall![0] / 2, 0.5];
      for (const [si, sj] of iso.surface!.spots) expect({ id: item.id, inside: si > 0 && si < w && sj > 0 && sj < d }).toEqual({ id: item.id, inside: true });
    }
  });

  it('wall art is at most 4 half-tiles wide, so a converted room\'s art ends before the plank (spec §2.4)', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === 'art')) expect({ id: item.id, w: item.iso!.wall![0] <= 4 }).toEqual({ id: item.id, w: true });
  });

  it('only desks, rugs and the welcome lantern have two drawn facings (ruling 3)', () => {
    const two = COSMETIC_ITEMS.filter((i) => isShipped(i) && i.iso?.facings === 2).map((i) => i.id);
    expect(two.every((id) => /^(desk|rug)\./.test(id) || id === 'set.cottage.desk' || id === 'set.cottage.rug' || id === 'lamp.welcome')).toBe(true);
    expect(two).toEqual(expect.arrayContaining(['desk.monitor', 'rug.slate', 'lamp.welcome', 'set.cottage.desk']));
  });

  it('the structural pieces: a 2-spot wall plank, the welcome lantern, the Cottage garland on the wall', () => {
    expect(cosmeticItem('shelf.plank')!.iso).toEqual({ layers: ['wall'], wall: [4, 1], surface: { z: 2, spots: [[0.5, 0.2], [1.5, 0.2]] }, facings: 1 });
    expect(cosmeticItem('lamp.welcome')!.iso).toEqual({ layers: ['floor', 'onTop'], foot: [1, 1], facings: 2 });
    expect(cosmeticItem('lamp.welcome')!.emissive).toBe(true);
    expect(cosmeticItem('set.cottage.lamp')!.iso).toEqual({ layers: ['wall'], wall: [8, 2], facings: 1 });
  });

  it('tags the Funny tab\'s pieces (ruling 20)', () => {
    expect(COSMETIC_ITEMS.filter((i) => i.tags?.includes('funny')).map((i) => i.id).sort()).toEqual(['corner.beanbag', 'item.controller', 'shelf.globe', 'shelf.luckycat']);
  });
});

// A copy count, once shipped, never changes (spec §2.1 `grants`).
const grantsShipped = JSON.parse(fs.readFileSync(path.join(__dirname, 'grantsShipped.json'), 'utf8')) as Record<string, number>;
it('keeps every shipped item\'s copy count; every shipped item is recorded', () => {
  for (const [id, n] of Object.entries(grantsShipped)) expect({ id, n: cosmeticItem(id)!.grants ?? 1 }).toEqual({ id, n });
  expect(COSMETIC_ITEMS.filter((i) => isShipped(i) && !(i.id in grantsShipped)).map((i) => i.id)).toEqual([]);
});
