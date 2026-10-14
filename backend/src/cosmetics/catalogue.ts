// KIP's room catalogue (spec 2026-10-14 KIP's room §1): every item id, its slot, flags and unlock rule, and the six
// theme sets, versioned like the badge catalogue. Rules: an id is permanent (never renamed, reused or deleted; a test
// pins every id ever written here); an item may be retired (kept by owners, never granted again); a raised threshold
// never takes anything away (unlocks are rows). Only items with release <= COSMETICS_RELEASE are exported to the app
// or granted, so nobody owns an item the app cannot draw. The art lives only in the app.

import type { AchievementFamily } from '@prisma/client';

export const COSMETICS_CATALOGUE_VERSION = 1;
export type CosmeticRelease = 1 | 2;
export const COSMETICS_RELEASE: CosmeticRelease = 1;
/** When each art release shipped (§3.1): a rule met before it grants as 'backfill'. Release 2's date is set with the bump. */
export const RELEASE_LAUNCHED_AT: Readonly<Partial<Record<CosmeticRelease, Date>>> = Object.freeze({
  1: new Date('2026-10-15T00:00:00.000Z'),
});

export const ROOM_SLOTS = ['wallpaper', 'floor', 'art', 'window', 'shelf', 'desk', 'desk_item', 'plant', 'lamp', 'corner', 'rug', 'pet'] as const;
export type RoomSlot = (typeof ROOM_SLOTS)[number];
export const WORN_SLOTS = ['head', 'face', 'neck', 'ears'] as const;
export type WornSlot = (typeof WORN_SLOTS)[number];
export type CosmeticSlot = RoomSlot | WornSlot;
/** Room slots that may be empty (§1); every worn slot may be empty too. */
export const OPTIONAL_ROOM_SLOTS: ReadonlySet<RoomSlot> = new Set<RoomSlot>(['art', 'corner', 'pet']);

export const SET_IDS = ['cottage', 'japanese', 'homeGym', 'gamerNight', 'stargazer', 'library'] as const;
export type SetId = (typeof SET_IDS)[number];
export type Level = 1 | 2 | 3 | 4 | 5;
export type CounterName = 'recaps_read' | 'buddy_cheers';

export type UnlockRule =
  | { kind: 'starter' }
  | { kind: 'family'; family: AchievementFamily; level: Level }
  | { kind: 'anyFamily'; level: Level }
  | { kind: 'counter'; counter: CounterName; atLeast: number }
  | { kind: 'set'; set: SetId };
export type SetRule = Extract<UnlockRule, { kind: 'family' | 'anyFamily' | 'counter' }>;

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  unlock: UnlockRule;
  release: CosmeticRelease;
  sets?: SetId[];
  tint?: true;
  emissive?: true;
  frames?: 3;
  style?: 'standard' | 'low';
  retired?: true;
}

export interface CosmeticSet {
  id: SetId;
  release: CosmeticRelease;
  unlock: SetRule;
  style: 'standard' | 'low';
  room: Record<RoomSlot, string>;
  worn: Partial<Record<WornSlot, string>>;
}

const FAMILY_CODES: Record<string, AchievementFamily> = {
  SG: 'SLEEP_GOAL', SB: 'STEADY_BEDTIME', ST: 'STEP_GOAL', CI: 'CHECK_IN', BR: 'BEST_RECOVERY_WEEK', EL: 'EVERY_DAY_LOGGED', SM: 'STEADIEST_MONTH',
};

/** A Cat board unlock code: 'S' starter, 'SB3' a family level, 'ANY4', 'RC8' recaps read, 'CB10' buddy cheers. */
export function ruleOf(code: string): UnlockRule {
  if (code === 'S') return { kind: 'starter' };
  const m = /^([A-Z]+)(\d+)$/.exec(code);
  if (!m) throw new Error(`Unknown unlock code ${code}`);
  const [, key, digits] = m;
  const n = Number(digits);
  if (key === 'ANY') return { kind: 'anyFamily', level: n as Level };
  if (key === 'RC') return { kind: 'counter', counter: 'recaps_read', atLeast: n };
  if (key === 'CB') return { kind: 'counter', counter: 'buddy_cheers', atLeast: n };
  const family = FAMILY_CODES[key!];
  if (!family || n < 1 || n > 5) throw new Error(`Unknown unlock code ${code}`);
  return { kind: 'family', family, level: n as Level };
}

// [id, slot, unlock code, flags (T tint, G glow/emissive, A 3-frame loop), release]. Copied from the Cat boards
// (CatWalls.dc.html:87-96, CatWindow.dc.html:77-99, CatDesk.dc.html:76-109, CatFloor.dc.html:78-128,
// CatOutfit.dc.html:68-90). Release 1: starters, family levels I-II, any family I-II, 4 recaps, 5 cheers.
type Row = readonly [string, CosmeticSlot, string, string, CosmeticRelease];
const BASE: readonly Row[] = [
  ['wall.plain', 'wallpaper', 'S', '', 1],
  ['wall.dots', 'wallpaper', 'S', '', 1],
  ['wall.stripes', 'wallpaper', 'SB1', 'T', 1],
  ['wall.brick', 'wallpaper', 'ST2', '', 1],
  ['wall.panel', 'wallpaper', 'RC4', '', 1],
  ['wall.shoji', 'wallpaper', 'SB3', '', 2],
  ['wall.concrete', 'wallpaper', 'ST3', '', 2],
  ['wall.florals', 'wallpaper', 'CB5', '', 1],
  ['wall.checker', 'wallpaper', 'CI2', '', 1],
  ['wall.subway', 'wallpaper', 'EL2', '', 1],
  ['wall.neon', 'wallpaper', 'CI4', 'G', 2],
  ['wall.stars', 'wallpaper', 'SM4', 'GA', 2],
  ['floor.oakDark', 'floor', 'S', '', 1],
  ['floor.oakLight', 'floor', 'RC8', '', 2],
  ['floor.tatami', 'floor', 'SB3', '', 2],
  ['floor.tiles', 'floor', 'EL1', '', 1],
  ['floor.carpet', 'floor', 'SG1', 'T', 1],
  ['floor.checker', 'floor', 'CI3', '', 2],
  ['floor.concrete', 'floor', 'ST2', '', 1],
  ['floor.rubber', 'floor', 'ST3', '', 2],
  ['floor.neon', 'floor', 'CI5', 'G', 2],
  ['art.calendar', 'art', 'S', '', 1],
  ['art.mountain', 'art', 'SG1', '', 1],
  ['art.pennant', 'art', 'CI1', 'T', 1],
  ['art.clock', 'art', 'EL1', 'A', 1],
  ['art.heart', 'art', 'SB2', 'G', 1],
  ['art.motto', 'art', 'SG2', '', 1],
  ['art.map', 'art', 'ST3', '', 2],
  ['art.game', 'art', 'CI3', '', 2],
  ['art.band', 'art', 'EL2', '', 1],
  ['art.cork', 'art', 'RC4', '', 1],
  ['art.wave', 'art', 'SM2', '', 1],
  ['art.medal', 'art', 'BR3', '', 2],
  ['win.plain', 'window', 'S', '', 1],
  ['win.curtains', 'window', 'SB1', 'T', 1],
  ['win.blinds', 'window', 'ST1', '', 1],
  ['win.sticker', 'window', 'CI2', '', 1],
  ['win.pots', 'window', 'SG3', '', 2],
  ['win.fairy', 'window', 'CB5', 'GA', 1],
  ['win.noren', 'window', 'SB3', 'T', 2],
  ['win.chime', 'window', 'BR1', 'A', 1],
  ['shelf.books', 'shelf', 'S', '', 1],
  ['shelf.minicactus', 'shelf', 'S', '', 1],
  ['shelf.trophyB', 'shelf', 'ANY1', '', 1],
  ['shelf.trophyS', 'shelf', 'ANY3', '', 2],
  ['shelf.trophyG', 'shelf', 'ANY5', 'G', 2],
  ['shelf.figurine', 'shelf', 'CB10', 'T', 2],
  ['shelf.globe', 'shelf', 'SM1', 'A', 1],
  ['shelf.luckycat', 'shelf', 'BR2', 'A', 1],
  ['shelf.vinyl', 'shelf', 'EL3', '', 2],
  ['shelf.kendama', 'shelf', 'CI4', '', 2],
  ['desk.monitor', 'desk', 'S', 'GA', 1],
  ['desk.notebook', 'desk', 'S', '', 1],
  ['desk.laptop', 'desk', 'ST1', 'GA', 1],
  ['desk.dual', 'desk', 'BR4', 'G', 2],
  ['desk.crt', 'desk', 'SM3', 'G', 2],
  ['desk.typewriter', 'desk', 'RC8', '', 2],
  ['desk.tablet', 'desk', 'CI5', 'T', 2],
  ['item.mug', 'desk_item', 'S', 'TA', 1],
  ['item.sticky', 'desk_item', 'S', '', 1],
  ['item.bottle', 'desk_item', 'SG1', '', 1],
  ['item.pills', 'desk_item', 'EL1', '', 1],
  ['item.shaker', 'desk_item', 'ST2', '', 1],
  ['item.can', 'desk_item', 'EL4', '', 2],
  ['item.matcha', 'desk_item', 'SB4', 'A', 2],
  ['item.alarm', 'desk_item', 'SG4', 'A', 2],
  ['item.duck', 'desk_item', 'CB15', '', 2],
  ['item.stand', 'desk_item', 'EL2', 'T', 1],
  ['item.controller', 'desk_item', 'ANY2', '', 1],
  ['item.deskglobe', 'desk_item', 'SM4', 'A', 2],
  ['plant.fern', 'plant', 'S', '', 1],
  ['plant.cactus', 'plant', 'S', '', 1],
  ['plant.monstera', 'plant', 'SG1', '', 1],
  ['plant.snake', 'plant', 'ST2', '', 1],
  ['plant.succulents', 'plant', 'EL2', '', 1],
  ['plant.bamboo', 'plant', 'SM2', '', 1],
  ['plant.bonsai', 'plant', 'SB3', '', 2],
  ['plant.sunflower', 'plant', 'CB5', '', 1],
  ['plant.glowfern', 'plant', 'BR5', 'GA', 2],
  ['lamp.amber', 'lamp', 'S', 'GA', 1],
  ['lamp.mint', 'lamp', 'CI1', 'G', 1],
  ['lamp.kiplamp', 'lamp', 'SB1', 'TG', 1],
  ['lamp.salt', 'lamp', 'SG2', 'G', 1],
  ['lamp.neonbolt', 'lamp', 'CI3', 'G', 2],
  ['lamp.lantern', 'lamp', 'SB4', 'G', 2],
  ['lamp.lava', 'lamp', 'EL4', 'GA', 2],
  ['lamp.reading', 'lamp', 'RC12', 'G', 2],
  ['corner.floorlamp', 'corner', 'SB2', 'G', 1],
  ['corner.yogamat', 'corner', 'SM1', 'T', 1],
  ['corner.kettlebell', 'corner', 'ST3', 'T', 2],
  ['corner.weights', 'corner', 'ST4', '', 2],
  ['corner.bag', 'corner', 'BR2', 'A', 1],
  ['corner.bike', 'corner', 'ST5', '', 2],
  ['corner.fan', 'corner', 'SG5', 'A', 2],
  ['corner.beanbag', 'corner', 'ANY2', 'T', 1],
  ['corner.cushion', 'corner', 'SB3', 'T', 2],
  ['corner.guitar', 'corner', 'EL5', '', 2],
  ['corner.bookcase', 'corner', 'RC12', '', 2],
  ['corner.telescope', 'corner', 'SM5', '', 2],
  ['rug.slate', 'rug', 'S', '', 1],
  ['rug.red', 'rug', 'SG1', '', 1],
  ['rug.gymmat', 'rug', 'ST1', '', 1],
  ['rug.checker', 'rug', 'EL1', '', 1],
  ['rug.woven', 'rug', 'CI2', '', 1],
  ['rug.tatami', 'rug', 'SB2', '', 1],
  ['rug.shaggy', 'rug', 'CB15', 'T', 2],
  ['rug.rainbow', 'rug', 'ANY4', '', 2],
  ['pet.bed', 'pet', 'CI1', 'T', 1],
  ['pet.fish', 'pet', 'BR4', 'A', 2],
  ['pet.cat', 'pet', 'CB10', 'A', 2],
  ['pet.hamster', 'pet', 'EL4', 'A', 2],
  ['pet.dog', 'pet', 'ST4', 'A', 2],
  ['out.beanie', 'head', 'S', '', 1],
  ['out.cap', 'head', 'ST1', '', 1],
  ['out.sweatband', 'head', 'ST2', '', 1],
  ['out.bucket', 'head', 'SG2', 'T', 1],
  ['out.hachimaki', 'head', 'SB2', '', 1],
  ['out.beret', 'head', 'BR2', '', 1],
  ['out.chef', 'head', 'EL3', '', 2],
  ['out.party', 'head', 'CB5', 'T', 1],
  ['out.crown', 'head', 'ANY5', 'G', 2],
  ['out.round', 'face', 'CI1', '', 1],
  ['out.shades', 'face', 'BR3', '', 2],
  ['out.paint', 'face', 'CI3', '', 2],
  ['out.monocle', 'face', 'SM3', '', 2],
  ['out.mask', 'face', 'SG5', '', 2],
  ['out.scarf', 'neck', 'SB1', '', 1],
  ['out.bowtie', 'neck', 'EL2', '', 1],
  ['out.towel', 'neck', 'ST3', '', 2],
  ['out.bandana', 'neck', 'CB10', '', 2],
  ['out.medal', 'neck', 'BR5', 'G', 2],
  ['out.earbuds', 'ears', 'S', '', 1],
  ['out.phones', 'ears', 'EL1', '', 1],
  ['out.muffs', 'ears', 'SG3', '', 2],
];

// The six theme sets (spec §1 Theme sets; sets2.js). `reuse` maps a slot to the base item the board names for it;
// every other room slot gets a set-only piece `set.{id}.{slot}`. `flags` are those pieces' T/G/A flags.
interface SetDef {
  id: SetId; release: CosmeticRelease; code: string; style: 'standard' | 'low';
  reuse: Partial<Record<RoomSlot, string>>; worn: Partial<Record<WornSlot, string>>; flags: Partial<Record<RoomSlot, string>>;
}
const SET_DEFS: readonly SetDef[] = [
  { id: 'cottage', release: 1, code: 'RC4', style: 'standard', reuse: { plant: 'plant.fern' }, worn: { head: 'out.beanie' }, flags: { lamp: 'GA', corner: 'GA' } },
  { id: 'japanese', release: 2, code: 'SB3', style: 'low', reuse: { wallpaper: 'wall.shoji', floor: 'floor.tatami', plant: 'plant.bonsai', lamp: 'lamp.lantern' }, worn: { head: 'out.hachimaki' }, flags: {} },
  { id: 'homeGym', release: 2, code: 'ST4', style: 'standard', reuse: { floor: 'floor.rubber', window: 'win.blinds', plant: 'plant.snake', corner: 'corner.weights', pet: 'pet.dog' }, worn: { head: 'out.sweatband', neck: 'out.towel' }, flags: { lamp: 'G' } },
  { id: 'gamerNight', release: 2, code: 'ANY4', style: 'standard', reuse: { plant: 'plant.cactus', lamp: 'lamp.neonbolt', corner: 'corner.beanbag', rug: 'rug.rainbow', pet: 'pet.hamster' }, worn: { ears: 'out.phones' }, flags: { wallpaper: 'G', window: 'GA', desk_item: 'G' } },
  { id: 'stargazer', release: 2, code: 'SM5', style: 'standard', reuse: { corner: 'corner.telescope', rug: 'rug.shaggy', pet: 'pet.fish' }, worn: { face: 'out.round' }, flags: { wallpaper: 'GA', lamp: 'G', desk_item: 'G' } },
  { id: 'library', release: 2, code: 'RC12', style: 'standard', reuse: { floor: 'floor.oakDark', art: 'art.map', plant: 'plant.snake', lamp: 'lamp.reading', corner: 'corner.bookcase' }, worn: { face: 'out.round', neck: 'out.bowtie' }, flags: { window: 'A' } },
];

function withFlags(item: CosmeticItem, flags: string): CosmeticItem {
  const worn = (WORN_SLOTS as readonly string[]).includes(item.slot);
  return {
    ...item,
    ...(flags.includes('T') ? { tint: true as const } : {}),
    ...(flags.includes('G') ? { emissive: true as const } : {}),
    ...(flags.includes('A') && !worn ? { frames: 3 as const } : {}),
  };
}

function build(): { items: CosmeticItem[]; sets: CosmeticSet[] } {
  const items = new Map<string, CosmeticItem>();
  for (const [id, slot, code, flags, release] of BASE) {
    items.set(id, withFlags({ id, slot, unlock: ruleOf(code), release, ...(slot === 'desk' ? { style: 'standard' as const } : {}) }, flags));
  }
  const sets: CosmeticSet[] = [];
  for (const def of SET_DEFS) {
    const room = {} as Record<RoomSlot, string>;
    for (const slot of ROOM_SLOTS) {
      const reused = def.reuse[slot];
      const id = reused ?? `set.${def.id}.${slot}`;
      if (!reused) {
        items.set(id, withFlags({
          id, slot, unlock: { kind: 'set', set: def.id }, release: def.release, ...(slot === 'desk' ? { style: def.style } : {}),
        }, def.flags[slot] ?? ''));
      }
      room[slot] = id;
    }
    for (const id of [...Object.values(room), ...Object.values(def.worn)]) {
      const item = items.get(id!)!;
      items.set(id!, { ...item, sets: [...(item.sets ?? []), def.id] });
    }
    sets.push({ id: def.id, release: def.release, unlock: ruleOf(def.code) as SetRule, style: def.style, room, worn: { ...def.worn } });
  }
  return { items: [...items.values()], sets };
}

const BUILT = build();
export const COSMETIC_ITEMS: readonly CosmeticItem[] = Object.freeze(BUILT.items);
export const COSMETIC_SETS: readonly CosmeticSet[] = Object.freeze(BUILT.sets);
const ITEM_BY_ID = new Map(COSMETIC_ITEMS.map((i) => [i.id, i]));
const SET_BY_ID = new Map(COSMETIC_SETS.map((s) => [s.id, s]));

export function cosmeticItem(id: string): CosmeticItem | undefined {
  return ITEM_BY_ID.get(id);
}
export function cosmeticSet(id: string): CosmeticSet | undefined {
  return SET_BY_ID.get(id as SetId);
}

/** Spec A's starter furnishing (mobile STARTER_LOADOUT is pinned to this by a mobile test). */
export const STARTER_ROOM: Readonly<Record<RoomSlot, string | null>> = Object.freeze({
  wallpaper: 'wall.plain', floor: 'floor.oakDark', art: 'art.calendar', window: 'win.plain', shelf: 'shelf.books',
  desk: 'desk.monitor', desk_item: 'item.mug', plant: 'plant.fern', lamp: 'lamp.amber', corner: null, rug: 'rug.slate', pet: null,
});
/** The starter worn loadout is all empty: Beanie and Earbuds are owned, not worn (§1). */
export const EMPTY_WORN: Readonly<Record<WornSlot, string | null>> = Object.freeze({ head: null, face: null, neck: null, ears: null });
export const STARTER_IDS: readonly string[] = COSMETIC_ITEMS.filter((i) => i.unlock.kind === 'starter').map((i) => i.id);
