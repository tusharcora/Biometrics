// KIP's room catalogue (spec 2026-10-14 KIP's room §1): every item id, its slot, flags and unlock rule, and the six
// theme sets, versioned like the badge catalogue. Rules: an id is permanent (never renamed, reused or deleted; a test
// pins every id ever written here); an item may be retired (kept by owners, never granted again); a raised threshold
// never takes anything away (unlocks are rows). Only items whose release is in SHIPPED_RELEASES are exported to the app
// or granted (free-build §2.1: releases no longer ship in order), so nobody owns an item the app cannot draw. The art
// lives only in the app; placement data (`iso`) lives here because the server validates layouts.

import type { AchievementFamily } from '@prisma/client';
import type { EffectKind, IsoSpec } from '../room/geometry';

export const COSMETICS_CATALOGUE_VERSION = 1;
export type CosmeticRelease = 1 | 2 | 3 | 4 | 5;
/** Releases the app can draw. B2 (release 2) joins when its art ships; free-build P1's pieces are release 3, P2's shop
 * pieces release 4, P3's effect pieces release 5. */
export const SHIPPED_RELEASES: ReadonlySet<CosmeticRelease> = new Set<CosmeticRelease>([1, 3, 4, 5]);
export type ShippedRelease = 1 | 3 | 4 | 5;
/**
 * When each shipped release reached users (Spec B §3.1): a rule met before it grants as 'backfill'. A full record,
 * so a release cannot ship without a date (Spec B Task 3 minor). OWNER NOTE (plan ruling 1): both are set to the real
 * ship date when Spec B and P1 merge. OWNER NOTE (P2 plan ruling 1): release 4's date is set with the coins launch at
 * merge. OWNER NOTE (P3 plan ruling 1): release 5's date is set at merge.
 */
export const RELEASE_LAUNCHED_AT: Readonly<Record<ShippedRelease, Date>> = Object.freeze({
  1: new Date('2026-10-15T00:00:00.000Z'),
  3: new Date('2026-10-16T00:00:00.000Z'),
  4: new Date('2026-10-20T00:00:00.000Z'),
  5: new Date('2026-10-23T00:00:00.000Z'),
});
export function isShipped(x: { release: CosmeticRelease }): boolean {
  return SHIPPED_RELEASES.has(x.release);
}

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
  | { kind: 'shop' }
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
  /** Placement rules (free-build §2.1); styles and worn items have none. */
  iso?: IsoSpec;
  /** Copies an unlock gives; default 1; frozen once shipped (tests/cosmetics/grantsShipped.json). */
  grants?: number;
  /** 'funny' (the drawer's Funny tab); P4 adds challenge tags. */
  tags?: string[];
  /** Coins (spec §6.4); absent = not in the shop. */
  price?: number;
  /** 'always', or only in that ISO week (P4's theme pieces); every P2 price is 'always' (plan ruling 4). */
  shop?: 'always' | { week: string };
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

/** A Cat board unlock code: 'S' starter, 'C' the coin shop only, 'SB3' a family level, 'ANY4', 'RC8' recaps read, 'CB10' buddy cheers. */
export function ruleOf(code: string): UnlockRule {
  if (code === 'S') return { kind: 'starter' };
  if (code === 'C') return { kind: 'shop' };
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

// Free-build P1's structural pieces (spec 2026-10-15 §2.1): a wall plank for the old shelf slot's items, and C7's
// welcome lantern, owned by everyone from P1.
const FREEBUILD: readonly Row[] = [
  ['shelf.plank', 'shelf', 'S', '', 3],
  ['lamp.welcome', 'lamp', 'S', 'G', 3],
];

// Free-build P2's coin-shop pieces (spec 2026-10-15 §4: F6, C1): bought with coins, never unlocked by a rule.
const SHOP_PIECES: readonly Row[] = [
  ['item.radio', 'desk_item', 'C', '', 4],
  ['corner.gnome', 'corner', 'C', '', 4],
  ['corner.cone', 'corner', 'C', '', 4],
  ['corner.pumpkin', 'corner', 'C', '', 4],
  ['item.candle', 'desk_item', 'C', 'G', 4],
  ['art.neonheart', 'art', 'C', 'G', 4],
];

// Free-build P3's effect pieces (spec 2026-10-15 §8.2): the ginger cat (coin shop) and the trophy shelf (everyone's).
const LIVING_PIECES: readonly Row[] = [
  ['pet.tabby', 'pet', 'C', 'A', 5],
  ['shelf.awards', 'shelf', 'S', '', 5],
];

/** The first set of effects (spec §8.2, P3 rulings 2-3). B2's three are set now and run when release 2 ships. */
export const EFFECTS: Readonly<Record<string, EffectKind>> = {
  'corner.floorlamp': 'light', 'lamp.lava': 'light', 'item.radio': 'sound', 'pet.tabby': 'wander', 'pet.cat': 'wander',
  'art.clock': 'clock', 'item.duck': 'tap', 'shelf.awards': 'awards',
};

/**
 * Coin prices (spec §6.4: 25–200), all 'always' in P2 (plan rulings 2–4): the shop's own pieces, every placeable
 * starter as an extra copy (not the desks, one per room, and not the welcome lantern, C7's gift), and the rule pieces
 * the boards price, sold only once earned. B2's three are priced now and shown when release 2 ships.
 */
export const PRICES: Readonly<Record<string, number>> = {
  'item.radio': 150, 'corner.gnome': 80, 'corner.cone': 60, 'corner.pumpkin': 30, 'item.candle': 25, 'art.neonheart': 200,
  'plant.fern': 40, 'plant.cactus': 40, 'item.mug': 25, 'item.sticky': 25, 'shelf.books': 30, 'shelf.minicactus': 30,
  'shelf.plank': 30, 'lamp.amber': 60, 'rug.slate': 80, 'art.calendar': 40,
  'corner.floorlamp': 120, 'pet.bed': 140, 'plant.monstera': 140, 'plant.snake': 100,
  'lamp.lava': 120, 'item.duck': 40, 'pet.cat': 180, 'pet.tabby': 180,
};

/** KIP's desk and chair (spec §2.1, §3.2): 3 × 2, KIP's seat on the front row, 3 spots on the desk top. */
const DESK_ISO: IsoSpec = {
  layers: ['floor'], foot: [3, 2], facings: 2, kipDesk: true, seat: [1, 1],
  surface: { z: 22, spots: [[0.45, 0.55], [1.5, 0.6], [2.55, 0.55]] },
};
const SLOT_ISO: Partial<Record<RoomSlot, IsoSpec>> = {
  art: { layers: ['wall'], wall: [4, 6], facings: 1 },
  shelf: { layers: ['onTop'], facings: 1 },
  desk: DESK_ISO,
  desk_item: { layers: ['onTop'], facings: 1 },
  plant: { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  lamp: { layers: ['onTop'], facings: 1 },
  corner: { layers: ['floor'], foot: [1, 1], facings: 1 },
  rug: { layers: ['floor'], foot: [4, 3], flat: true, facings: 2 },
  pet: { layers: ['floor'], foot: [1, 1], facings: 1 },
};
/** Each release-1 art piece's wall size from its front-on bounds (pin and shadow included): ceil(w / 6) half tiles ×
 * ceil(h / 4) steps (plan ruling 4). Release-2 art keeps the slot default until its iso art is drawn. */
const ART_WALL: Readonly<Record<string, [number, number]>> = {
  'art.calendar': [3, 6], 'art.mountain': [4, 5], 'art.pennant': [3, 5], 'art.clock': [3, 5], 'art.heart': [3, 4],
  'art.motto': [3, 6], 'art.band': [3, 6], 'art.cork': [4, 5], 'art.wave': [4, 5], 'set.cottage.art': [3, 5],
};
/** Rug footprints: each fits the converted room's rug tiles from (1, 2) (spec §2.4). */
const RUG_FOOT: Readonly<Record<string, [number, number]>> = {
  'rug.slate': [4, 4], 'rug.red': [4, 3], 'rug.gymmat': [4, 2], 'rug.checker': [3, 3], 'rug.woven': [3, 3], 'rug.tatami': [4, 3],
  'set.cottage.rug': [4, 3],
};
const ISO_OVERRIDES: Readonly<Record<string, IsoSpec>> = {
  'shelf.plank': { layers: ['wall'], wall: [4, 1], surface: { z: 2, spots: [[0.5, 0.2], [1.5, 0.2]] }, facings: 1 },
  'lamp.welcome': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 2 },
  // The fairy lights along the beam become a garland on the left wall, above the window (plan ruling 7).
  'set.cottage.lamp': { layers: ['wall'], wall: [8, 2], facings: 1 },
  // The shop's small pieces stand on the floor or a surface; the sign hangs like art.
  'item.radio': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.gnome': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.cone': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.pumpkin': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'item.candle': { layers: ['onTop', 'floor'], foot: [1, 1], facings: 1 },
  'art.neonheart': { layers: ['wall'], wall: [3, 4], facings: 1 },
  // The trophy shelf hangs on a wall: a plank 4 tiles long with room for 8 awards (P3 ruling 2).
  'shelf.awards': { layers: ['wall'], wall: [8, 3], facings: 1 },
};
const FUNNY: ReadonlySet<string> = new Set(['shelf.luckycat', 'shelf.globe', 'item.controller', 'corner.beanbag']);

function isoFor(item: CosmeticItem): IsoSpec | undefined {
  const over = ISO_OVERRIDES[item.id];
  if (over) return over;
  const base = SLOT_ISO[item.slot as RoomSlot];
  if (!base) return undefined;
  const wall = ART_WALL[item.id];
  if (item.slot === 'art' && wall) return { ...base, wall };
  const foot = RUG_FOOT[item.id];
  if (item.slot === 'rug' && foot) return { ...base, foot };
  return base;
}

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
  for (const [id, slot, code, flags, release] of [...BASE, ...FREEBUILD, ...SHOP_PIECES, ...LIVING_PIECES]) {
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
  for (const [id, item] of items) {
    const iso = isoFor(item);
    const effect = EFFECTS[id];
    const price = PRICES[id];
    items.set(id, {
      ...item,
      // isoFor returns shared objects (SLOT_ISO, DESK_ISO): the spread never writes into them.
      ...(iso ? { iso: effect ? { ...iso, effect } : iso } : {}),
      ...(FUNNY.has(id) ? { tags: ['funny'] } : {}),
      ...(price !== undefined ? { price, shop: 'always' as const } : {}),
    });
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
export function shippedItem(id: string): CosmeticItem | undefined {
  const item = ITEM_BY_ID.get(id);
  return item && isShipped(item) ? item : undefined;
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
