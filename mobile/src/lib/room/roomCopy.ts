// Every string of KIP's room (spec 2026-10-14 KIP's room): item and set names, unlock lines (the Cat boards'
// wording), decorate mode, the toasts. Spoken forms carry no "·" and no Roman numerals (ruling 19).
import type { AchievementsSnapshot } from '../achievementsStore';
import type { AchievementFamilyName, SetId, UnlockRule } from './catalogue';
import { catalogueSet } from './catalogue';
import type { ItemId } from './loadout';
import type { RoomSlot, WornSlot } from './catalogue';

export const ITEM_NAMES: Readonly<Record<ItemId, string>> = {
  'wall.plain': 'Plain slate', 'wall.dots': 'Dots', 'wall.stripes': 'Tinted stripes', 'wall.brick': 'Brick',
  'wall.panel': 'Wood panel', 'wall.florals': 'Florals', 'wall.checker': 'Checker', 'wall.subway': 'Subway tiles',
  'floor.oakDark': 'Dark oak', 'floor.tiles': 'White tiles', 'floor.carpet': 'Tinted carpet', 'floor.concrete': 'Polished concrete',
  'art.calendar': 'Wall calendar', 'art.mountain': 'Mountain print', 'art.pennant': 'Pennant', 'art.clock': 'Wall clock',
  'art.heart': 'Neon heart', 'art.motto': '“SLEEP IS A SKILL” poster', 'art.band': 'Band poster · “The Naps”',
  'art.cork': 'Cork board with notes', 'art.wave': 'Great wave print',
  'win.plain': 'Plain frame', 'win.curtains': 'Curtains', 'win.blinds': 'Blinds', 'win.sticker': 'Sticker sun',
  'win.fairy': 'Fairy lights', 'win.chime': 'Wind chime',
  'shelf.books': 'Books', 'shelf.minicactus': 'Mini cactus', 'shelf.trophyB': 'Bronze trophy', 'shelf.globe': 'Snow globe',
  'shelf.luckycat': 'Lucky cat', 'shelf.plank': 'Wall plank',
  'desk.monitor': 'Monitor', 'desk.notebook': 'Notebook', 'desk.laptop': 'Laptop',
  'item.mug': 'Mug', 'item.sticky': 'Sticky notes', 'item.bottle': 'Water bottle', 'item.pills': 'Pill organiser',
  'item.shaker': 'Protein shaker', 'item.stand': 'Headphones stand', 'item.controller': 'Game controller',
  'plant.fern': 'Fern', 'plant.cactus': 'Cactus', 'plant.monstera': 'Monstera', 'plant.snake': 'Snake plant',
  'plant.succulents': 'Succulent trio', 'plant.bamboo': 'Lucky bamboo', 'plant.sunflower': 'Sunflower',
  'lamp.amber': 'Amber desk lamp', 'lamp.mint': 'Mint desk lamp', 'lamp.kiplamp': 'KIP-colour lamp', 'lamp.salt': 'Salt lamp',
  'lamp.welcome': 'Welcome lantern',
  'corner.floorlamp': 'Floor lamp', 'corner.yogamat': 'Yoga mat roll', 'corner.bag': 'Punching bag', 'corner.beanbag': 'Bean bag',
  'rug.slate': 'Slate rug', 'rug.red': 'Red rug', 'rug.gymmat': 'Gym mat', 'rug.checker': 'Checker rug',
  'rug.woven': 'Round woven', 'rug.tatami': 'Tatami mat',
  'pet.bed': 'Pet bed',
  'out.beanie': 'Beanie', 'out.cap': 'Cap', 'out.sweatband': 'Sweatband', 'out.bucket': 'Bucket hat',
  'out.hachimaki': 'Hachimaki headband', 'out.beret': 'Beret', 'out.party': 'Party hat', 'out.round': 'Round glasses',
  'out.scarf': 'Scarf', 'out.bowtie': 'Bow tie', 'out.earbuds': 'Earbuds', 'out.phones': 'Headphones',
  // The Cottage set (sets2.js:239), one name per piece (ruling 3).
  'set.cottage.wallpaper': 'Plaster and oak beams', 'set.cottage.floor': 'Light oak boards',
  'set.cottage.window': 'Gingham curtains', 'set.cottage.art': 'Embroidery hoop', 'set.cottage.shelf': 'Jars and plates',
  'set.cottage.desk': 'Farmhouse table', 'set.cottage.desk_item': 'Rose teapot', 'set.cottage.lamp': 'Fairy lights on the beam',
  'set.cottage.corner': 'Wood stove', 'set.cottage.rug': 'Patchwork quilt rug', 'set.cottage.pet': 'Dog in a pet bed',
};

export const SET_NAMES: Readonly<Record<SetId, string>> = { cottage: 'Cottage' };

/** Lower-case slot names for sentences ("in the wallpaper spot", "Decorate the desk item"). */
export const SLOT_NAMES: Readonly<Record<RoomSlot | WornSlot, string>> = {
  wallpaper: 'wallpaper', floor: 'floor', art: 'art', window: 'window', shelf: 'shelf', desk: 'desk', desk_item: 'desk item',
  plant: 'plant', lamp: 'lamp', corner: 'corner', rug: 'rug', pet: 'pet', head: 'head', face: 'face', neck: 'neck', ears: 'ears',
};

/** Category chips and the KIP tab's group headers. */
export const SLOT_TITLES: Readonly<Record<RoomSlot | WornSlot, string>> = {
  wallpaper: 'Wallpaper', floor: 'Floor', art: 'Art', window: 'Window', shelf: 'Shelf', desk: 'Desk', desk_item: 'Desk item',
  plant: 'Plant', lamp: 'Lamp', corner: 'Corner', rug: 'Rug', pet: 'Pet', head: 'Head', face: 'Face', neck: 'Neck', ears: 'Ears',
};

const FAMILY_NAMES: Record<AchievementFamilyName, string> = {
  SLEEP_GOAL: 'Sleep goal', STEADY_BEDTIME: 'Steady bedtime', STEP_GOAL: 'Step goal', CHECK_IN: 'Check-in',
  BEST_RECOVERY_WEEK: 'Best recovery week', EVERY_DAY_LOGGED: 'Every day logged', STEADIEST_MONTH: 'Steadiest month',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function itemName(id: ItemId): string {
  return ITEM_NAMES[id] ?? id;
}
/** A stored piece's name in its slot; a piece this build does not know (a newer server's id) reads as the slot. */
export function itemNameIn(id: ItemId, slot: RoomSlot | WornSlot): string {
  return ITEM_NAMES[id] ?? SLOT_TITLES[slot];
}
export function spokenName(id: ItemId): string {
  return itemName(id).split(' · ').join(', ');
}

function setRule(rule: UnlockRule): UnlockRule {
  return rule.kind === 'set' ? catalogueSet(rule.set)?.unlock ?? rule : rule;
}

export function unlockLine(rule: UnlockRule): string {
  const r = setRule(rule);
  switch (r.kind) {
    case 'starter': return 'In every room from day one';
    case 'family': return `${FAMILY_NAMES[r.family]} · ${ROMAN[r.level]}`;
    case 'anyFamily': return `Any family · level ${ROMAN[r.level]}`;
    case 'counter': return r.counter === 'recaps_read' ? `Read ${r.atLeast} weekly recaps` : `Cheer a buddy ${r.atLeast} times`;
    case 'set': return '';
  }
}

export function unlockSpoken(rule: UnlockRule): string {
  const r = setRule(rule);
  if (r.kind === 'family') return `${FAMILY_NAMES[r.family]}, level ${r.level}`;
  if (r.kind === 'anyFamily') return `Any family, level ${r.level}`;
  return unlockLine(r);
}

export interface ProgressFacts {
  /** Highest earned level per family (0 or missing: none). */
  levels: Partial<Record<AchievementFamilyName, number>>;
  recapsRead: number;
  buddyCheers: number;
}

export function progressLine(rule: UnlockRule, facts: ProgressFacts): string {
  const r = setRule(rule);
  switch (r.kind) {
    case 'family': {
      const lvl = facts.levels[r.family] ?? 0;
      return lvl ? `level ${ROMAN[lvl]} now` : 'No level yet';
    }
    case 'anyFamily': {
      const lvl = Math.max(0, ...Object.values(facts.levels).map((l) => l ?? 0));
      return lvl ? `highest level ${ROMAN[lvl]} now` : 'No level yet';
    }
    case 'counter':
      return r.counter === 'recaps_read' ? `${facts.recapsRead} of ${r.atLeast} read` : `${facts.buddyCheers} of ${r.atLeast}`;
    default:
      return '';
  }
}

/** Progress facts from the badge store the app already has, plus the server's two counters. */
export function progressFromAchievements(snapshot: AchievementsSnapshot, counters: { recapsRead: number; buddyCheers: number }): ProgressFacts {
  const levels: Partial<Record<AchievementFamilyName, number>> = {};
  if (snapshot.state.status === 'ready') for (const f of snapshot.state.data.families) levels[f.family] = f.level;
  return { levels, ...counters };
}

export const ROOM_COPY = {
  decorate: 'Decorate',
  decorateLabel: "Decorate KIP's room",
  decorateLabelNew: "Decorate KIP's room. New things to place",
  cancel: 'Cancel',
  done: 'Done',
  undo: 'Undo',
  undoLabel: 'Undo the last change',
  tabsLabel: 'Decorate',
  none: 'None',
  noArt: 'No art',
  tags: { placed: 'Placed', owned: 'Owned' },
  flags: { tint: 'TINT', glow: 'GLOW', anim: 'ANIM' },
  edit: {
    title: 'EDITING',
    count: (n: number, cap: number) => `${n} / ${cap} in room`,
    countLabel: (n: number, cap: number) => `${n} of ${cap} pieces in the room`,
    roomLabel: "KIP's room, being edited",
    where: { floor: 'on the floor', wall: 'on the wall', on: (parent: string) => `on the ${parent}` },
    /** What the desk piece is called in a sentence: KIP's desk, whatever stands on it. */
    deskNoun: 'desk',
    /** Tiles count from 1 for people (the back corner is tile 1, 1). */
    tile: (x: number, y: number) => `tile ${x + 1}, ${y + 1}`,
    inventory: (n: number) => `×${n} in inventory`,
    inventorySpoken: (n: number) => `${n} in inventory`,
    onIt: (n: number) => `${n} on it`,
    tools: { move: 'Move', flip: 'Flip', turn: 'Turn', another: 'Another', store: 'Store', undo: 'Undo', redo: 'Redo', showGrid: 'Show grid', hideGrid: 'Hide grid', deselect: 'Done with this piece' },
    undoLabel: 'Undo the last change',
    redoLabel: 'Redo',
    storeLabel: (name: string, n: number) => (n ? `Store ${name} and ${n} ${n === 1 ? 'piece' : 'pieces'} on it` : `Store ${name}`),
    piecesTitle: 'Pieces in the room',
    reason: {
      outside: "Doesn't fit here",
      overlap: (name: string) => `Overlaps the ${name}`,
      window: 'Covers the window',
      spot: 'That spot is taken',
      parent: 'Nothing can stand on that',
      seat: "Blocks KIP's chair",
      full: 'Room is full',
      /** Replace desk with a desk you have none left of, or the desk already there (ruling UI-OUTCOMES). */
      none: 'None left to place',
      sameDesk: 'That desk is in the room already',
      layer: { floor: 'Only on the floor', wall: 'Only on the wall', onTop: 'Only on a desk or shelf', floorOnTop: 'Only on the floor or a surface' },
    },
  },
  set: {
    pieces: (n: number, unlock: string) => `${n} pieces · ${unlock}`,
    piecesSpoken: (n: number, unlock: string) => `${n} pieces, ${unlock}`,
    apply: 'Apply set',
    preview: 'Preview',
    applyLabel: (name: string) => `Apply the ${name} set`,
    previewLabel: (name: string) => `Preview the ${name} set`,
    /** After Apply set (ruling T9-FIX): what was left out because you don't have it yet, and whether your desk stayed. */
    applied: (name: string, missing: readonly string[], deskKept: boolean) => {
      const listed = missing.length > 3 ? `${missing.slice(0, 3).join(', ')} and ${missing.length - 3} more` : missing.join(', ');
      return [`${name} set applied.`, missing.length ? `Not yours yet: ${listed}.` : '', deskKept ? 'Your desk stayed.' : ''].filter(Boolean).join(' ');
    },
  },
  /** The drawer's last section (spec 2026-10-15 §5.4): each line a bold lead (K4b.dc.html:87-89) and its body. */
  arrive: {
    title: 'How new things arrive',
    items: [
      { lead: 'Badge families.', body: 'Sleep goal, Steady bedtime, Step goal, Check-in, Best recovery week, Every day logged and Steadiest month each unlock pieces at levels 1 to 5.' },
      { lead: 'Any family.', body: 'Trophies, the rainbow rug and KIP’s crown come from reaching a level in any family.' },
      { lead: 'Recaps and buddies.', body: 'Reading weekly recaps and cheering buddies add decor and whole sets.' },
      { lead: null, body: 'Nothing is sold. The starter room is yours from day one, and items are never taken away.' },
    ],
  },
  drawer: {
    title: (n: number) => `Inventory · ${n} not placed`,
    titleSpoken: (n: number) => `Inventory, ${n} not placed`,
    tabsLabel: 'Inventory',
    tabs: { all: 'All', floor: 'Floor', wall: 'Wall', onTop: 'On top', funny: 'Funny', new: 'New', room: 'Room', kip: 'KIP', sets: 'Sets' },
    rows: { wallpaper: 'Walls', floor: 'Floor', window: 'Window' },
    count: (n: number) => `×${n}`,
    allPlaced: 'All placed',
    newTag: 'NEW',
    none: 'None',
    place: 'Place',
    replaceDesk: 'Replace desk',
    more: 'Show more',
    less: 'Show less',
    tile: {
      piece: (name: string, n: number, isNew: boolean) => `${name}, ${n ? `${n} in inventory` : 'all placed'}${isNew ? ', new' : ''}`,
      style: (name: string, current: boolean) => (current ? `${name}, in your room` : `${name}. Use it`),
      worn: (name: string, wearing: boolean) => (wearing ? `${name}, wearing` : `${name}. Wear it`),
      locked: (name: string, unlock: string, progress: string) => (progress ? `${name}, locked. ${unlock}. ${progress}` : `${name}, locked. ${unlock}`),
    },
    full: {
      text: (cap: number) => `KIP's room is full. ${cap} pieces fit this room. Store something to make space, or grow the room`,
      store: 'Store a piece',
      hint: 'Tap a piece in the room, then Store.',
    },
    applyConfirm: (name: string) => `Store everything and set up ${name}?`,
    applyGo: 'Set it up',
    applyKeep: 'Not now',
    previewing: (name: string) => `Previewing ${name}`,
    stopPreview: 'Stop preview',
  },
  discard: { title: 'Discard your changes?', discard: 'Discard', keep: 'Keep editing' },
  loadFailed: { text: "Couldn't open your room just now. Check your connection and try again.", retry: 'Try again', close: 'Close' },
  refreshed: 'Something changed on another device. Your room was refreshed.',
  saveFailed: "Couldn't save your room. Try again.",
  newFor: (name: string, more: number) => (more > 0 ? `New for KIP's room: ${name} and ${more} more` : `New for KIP's room: ${name}`),
  backfill: (n: number) => `Your badges unlocked ${n} things for KIP's room`,
  dismiss: 'Dismiss',
  toastHint: "Opens decorate mode for KIP's room",
} as const;
