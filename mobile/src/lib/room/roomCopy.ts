// Every string of KIP's room (spec 2026-10-14 KIP's room): item and set names, unlock lines (the Cat boards'
// wording), decorate mode, the toasts. Spoken forms carry no "·" and no Roman numerals (ruling 19).
import type { FirstWeekTaskKey } from '../../api/coins';
import type { AchievementsSnapshot } from '../achievementsStore';
import type { AchievementFamilyName, SetId, UnlockRule } from './catalogue';
import { catalogueSet } from './catalogue';
import type { ItemId } from './loadout';
import type { RoomSlot, WornSlot } from './catalogue';
import { EARN_AMOUNTS } from '../coins/amounts';

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
  // The coin shop's own pieces (spec 2026-10-15 §4, F6, C1).
  'item.radio': 'Old radio', 'corner.gnome': 'Gnome', 'corner.cone': 'Traffic cone', 'corner.pumpkin': 'Pumpkin',
  'item.candle': 'Candle', 'art.neonheart': 'Neon heart sign',
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
    case 'shop': return 'From the coin shop';
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

/** 1500 → "1,500": the wallet's number, with no locale data needed. */
export function coinCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    /** Moving without a drag (spec §5.7): the arrows, Put on…, and what each press did. */
    nudge: {
      dirs: { backLeft: 'Back left', backRight: 'Back right', frontLeft: 'Front left', frontRight: 'Front right', up: 'Up', down: 'Down' },
      label: (dir: string) => `Move ${dir.toLowerCase()}`,
      putOn: 'Put on…',
      on: (noun: string) => `On the ${noun}`,
      onFloor: 'On the floor',
      done: 'Done moving',
      moved: (where: string) => `Moved. ${where}`,
      cant: (why: string) => `Can't move there: ${why.charAt(0).toLowerCase()}${why.slice(1)}`,
      tile: (x: number, y: number) => `Tile ${x + 1}, ${y + 1}`,
      wallStep: (y: number) => `On the wall, ${y + 1} up`,
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
      { lead: 'KIP coins.', body: 'Healthy days earn coins, up to 60 a day. The coin shop turns them into new pieces and extra copies.' },
      { lead: null, body: 'Nothing is sold for money: coins come only from healthy days. The starter room is yours from day one, and items are never taken away.' },
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
    /** The header's way to the coin shop (spec §5.4, §6.6). */
    shop: 'Coin shop',
    /** The header's way to Room sizes, so a room can grow at any time, not only when full (ruling PF-F5). */
    sizes: 'Room sizes',
    tile: {
      piece: (name: string, n: number, isNew: boolean) => `${name}, ${n ? `${n} in inventory` : 'all placed'}${isNew ? ', new' : ''}`,
      style: (name: string, current: boolean) => (current ? `${name}, in your room` : `${name}. Use it`),
      worn: (name: string, wearing: boolean) => (wearing ? `${name}, wearing` : `${name}. Wear it`),
      locked: (name: string, unlock: string, progress: string) => (progress ? `${name}, locked. ${unlock}. ${progress}` : `${name}, locked. ${unlock}`),
    },
    full: {
      text: (cap: number) => `KIP's room is full. ${cap} pieces fit this room. Store something to make space, or grow the room`,
      store: 'Store a piece',
      sizes: 'See room sizes',
      hint: 'Tap a piece in the room, then Store.',
    },
    applyConfirm: (name: string) => `Store everything and set up ${name}?`,
    applyGo: 'Set it up',
    applyKeep: 'Not now',
    previewing: (name: string) => `Previewing ${name}`,
    stopPreview: 'Stop preview',
  },
  /** KIP coins (spec 2026-10-15 §6.7, C1, F6): the wallet, the history and coins landing. Never a price in money. */
  coins: {
    walletLabel: (n: string) => `${n} KIP coins. Open coin history`,
    historyTitle: 'Coin history',
    close: 'Close',
    earnedToday: (earned: number, cap: number) => `Earned today · ${earned} of ${cap}`,
    earnedTodaySpoken: (earned: number, cap: number) => `Earned today, ${earned} of ${cap}`,
    capLine: 'A daily cap keeps it about habits, not grinding.',
    kinds: {
      sleep_goal: 'Hit your sleep goal', steps: 'Hit your step goal', checkin: 'Morning check-in', recap: 'Read your weekly recap',
      cheer_given: 'You cheered a room', cheer_got: 'A buddy cheered your room', challenge: 'Entered the room challenge',
      firstweek: 'First-week bonus', buy: 'Coin shop', expand: 'Your room grew',
    },
    /** A kind this build does not know yet (a later phase's source): neutral, never another kind's label. */
    kindUnknown: 'KIP coins',
    /** The short line under the room when coins land (spec §6.7): what happened, never a value. */
    landed: {
      sleep_goal: 'Sleep goal hit', steps: 'Step goal hit', checkin: 'Checked in', recap: 'Weekly recap read',
      cheer_given: 'Room cheered', cheer_got: 'Your room got a cheer', challenge: 'Challenge entered', firstweek: 'First-week bonus',
      buy: 'Coin shop', expand: 'Your room grew',
    },
    /** A row from today, on the device's 24-hour clock: "Today, 07:12". */
    today: (hours: number, minutes: number) => `Today, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    yesterday: 'Yesterday',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    /** An older row's day: "Mon 9 Nov". */
    dated: (day: string, date: number, month: string) => `${day} ${date} ${month}`,
    /** The row's amount on screen: "+20", "−150", or "+0 · daily cap" for an earn the cap held at 0. */
    amount: (n: number, capped: boolean) => `${n < 0 ? `−${-n}` : `+${n}`}${capped ? ' · daily cap' : ''}`,
    /** The same, read aloud (ruling PF-COPY): words for the sign, no "·", and the cap was reached. */
    amountSpoken: (n: number, capped: boolean) => `${n < 0 ? `minus ${-n} coins` : `plus ${n} coins`}${capped ? ', daily cap reached' : ''}`,
    rowSpoken: (label: string, when: string, amount: string) => `${label}, ${when}, ${amount}`,
    howTitle: 'How to earn',
    how: [
      `Sleep goal +${EARN_AMOUNTS.sleep_goal}`, `Step goal +${EARN_AMOUNTS.steps}`, `Recap read +${EARN_AMOUNTS.recap}`, `Check-in +${EARN_AMOUNTS.checkin}`,
    ],
    loadMore: 'Load more',
    loadMoreFailed: "Couldn't load more just now. Tap Load more to try again.",
    empty: 'No coins yet. Healthy days earn them: a sleep goal, a step goal, a check-in, a weekly recap.',
    shop: 'Coin shop',
    loadFailed: "Couldn't load your coins just now. Check your connection and try again.",
    retry: 'Try again',
    bubble: (n: number) => `+${n}!`,
    landLine: (what: string, more: number) => (more > 0 ? `${what} and ${more} more` : what),
    landSpoken: (n: number, what: string) => `Plus ${n} coins. ${what}`,
  },
  /** The coin shop (spec 2026-10-15 §6.6, C1, F6). Prices are coins only (ruling 11). */
  shop: {
    title: 'Coin shop',
    sub: 'A new featured set every Monday',
    close: 'Close',
    tabsLabel: 'Coin shop',
    tabs: { all: 'All', floor: 'Floor', wall: 'Wall', onTop: 'On top' },
    thisWeek: 'This week',
    sets: { cosyAutumn: 'Cosy autumn', greenCorner: 'Green corner', deskDay: 'Desk day', brightNight: 'Bright night' } as Readonly<Record<string, string>>,
    /** A set this build doesn't know yet (a newer server's): neutral, never the raw id. */
    setUnknown: 'Featured',
    setLine: (name: string, n: number) => `${name} set · ${n} pieces · this week`,
    setSpoken: (name: string, n: number) => `${name} set, ${n} pieces, this week`,
    seeSet: 'See the set',
    seeAll: 'See everything',
    tile: (name: string, price: string, owned: number) => `${name}, ${price} coins${owned ? `, ${owned} owned` : ''}`,
    tileLocked: (name: string, rule: string) => `${name}, locked. ${rule}`,
    owned: (n: number) => `×${n} owned`,
    where: {
      anywhere: 'Shelf, desk or floor', floor: 'Floor', onTop: 'Shelf or desk', wall: 'Wall',
      tiles: (w: number, d: number) => (w * d === 1 ? '1 tile' : `${w} × ${d} tiles`),
      tilesSpoken: (w: number, d: number) => (w * d === 1 ? '1 tile' : `${w} by ${d} tiles`),
      /** "Floor · 4 × 4 tiles", and read aloud "Floor, 4 by 4 tiles" (ruling PF-F10). */
      line: (place: string, tiles: string) => `${place} · ${tiles}`,
      spoken: (place: string, tiles: string) => `${place}, ${tiles}`,
    },
    have: (balance: string, after: string) => `You have ${balance} · ${after} after`,
    haveSpoken: (balance: string, after: string) => `You have ${balance}, ${after} after`,
    haveOnly: (balance: string) => `You have ${balance}`,
    goes: 'Goes to your inventory',
    get: (price: string) => `Get for ${price}`,
    needs: (n: string) => `Needs ${n} more`,
    notNow: 'Not now',
    /** A rule piece not earned yet (spec §6.5): its rule on screen, and read aloud with words, never "·" or a Roman
     * numeral (ruling PF-F6). */
    locked: (rule: string) => `Earn it first: ${rule}`,
    lockedSpoken: (rule: string) => `Earn it first: ${rule}`,
    bought: (name: string) => `${name} is in your inventory.`,
    short: 'Not enough coins for that yet.',
    notForSale: "That piece isn't in the shop just now.",
    failed: "Couldn't get it just now. Try again.",
    loadFailed: "Couldn't open the shop just now. Check your connection and try again.",
    retry: 'Try again',
    footer: 'Coins come from healthy days only. They can’t be bought.',
  },
  /** Room sizes and the unlock moment (spec 2026-10-15 §7, C2, F5). Effect slots join in P3 (ruling 14). */
  sizes: {
    title: 'Room sizes',
    sub: 'Coins and a streak, both',
    close: 'Close',
    names: { 1: 'Starter', 2: 'Bigger', 3: 'Loft' } as Readonly<Record<1 | 2 | 3, string>>,
    size: (n: number) => `${n} × ${n}`,
    sizeSpoken: (n: number) => `${n} by ${n}`,
    /** A size's row heading: "Bigger · 8 × 8", read aloud "Bigger, 8 by 8". */
    row: (name: string, size: string) => `${name} · ${size}`,
    rowSpoken: (name: string, size: string) => `${name}, ${size}`,
    pieces: (cap: number, window: boolean) => (window ? `${cap} pieces · second window` : `${cap} pieces`),
    piecesSpoken: (cap: number, window: boolean) => (window ? `${cap} pieces, second window` : `${cap} pieces`),
    yours: 'YOURS',
    coinsTitle: (price: string) => `${price} coins`,
    of: (have: string, need: string) => `${have} of ${need}`,
    streakTitle: (days: number) => `A ${days}-day check-in streak`,
    badgeTitle: (level: number) => `Sleep goal badge, level ${level}`,
    levelNow: (level: number) => `level ${level} now`,
    noLevel: 'No level yet',
    /** The badges couldn't be read: a gate's progress is never guessed as 0 (ruling T13-FIX M2). */
    unknown: 'not known yet',
    done: 'Done',
    gateSpoken: (title: string, progress: string) => `${title}, ${progress}`,
    grow: (n: number) => `Grow to ${n} × ${n}`,
    growSpoken: (n: number) => `Grow to ${n} by ${n}`,
    needs: (parts: readonly string[]) => `Needs ${parts.join(' and ')}.`,
    moreCoins: (n: string) => `${n} more coins`,
    moreDays: (n: number) => (n === 1 ? '1 more day in a row' : `${n} more days in a row`),
    badgeNeed: (level: number) => `the sleep goal badge, level ${level}`,
    both: "Coins alone never buy space, and a streak alone doesn't either.",
    previewLabel: (n: number) => `Your room at ${n} by ${n}. The dashed rows are the new floor`,
    grownLabel: (n: number) => `Your room at ${n} by ${n}`,
    moreRoom: 'MORE ROOM!',
    newFloor: 'NEW FLOOR',
    newWall: 'NEW WALL',
    grewTitle: 'Your room grew',
    grewWhy: (tier: 2 | 3, price: string, gate: number) =>
      (tier === 2 ? `${price} coins and ${gate} days of check-ins in a row.` : `${price} coins and the sleep goal badge, level ${gate}.`),
    grewMore: (pieces: number, window: boolean) => `+1 row each side · +${pieces} pieces${window ? ' · a second window' : ''}`,
    grewMoreSpoken: (pieces: number, window: boolean) => `One more row each side, ${pieces} more pieces${window ? ', and a second window' : ''}`,
    stored: (n: number) => `The new window needed the wall: ${n} ${n === 1 ? 'piece' : 'pieces'} went to your inventory`,
    place: 'Place things',
    later: 'Later',
    notYet: 'Not quite yet: your room sizes were refreshed.',
    failed: "Couldn't grow the room just now. Try again.",
    loadFailed: "Couldn't open your room sizes just now. Check your connection and try again.",
    retry: 'Try again',
  },
  /**
   * The first-week list (spec 2026-10-15 §11.2, C7). The next size's dashed rows are drawn on Room sizes only (plan
   * ruling 15), so the next line names that screen (ruling PF-F12).
   */
  firstWeek: {
    title: 'First week',
    head: (day: number, done: number) => `Day ${day} of 7 · ${done} of 7 done`,
    headSpoken: (day: number, done: number) => `First week, day ${day} of 7, ${done} of 7 done`,
    tasks: {
      checkin: 'First check-in', place: 'Place your first piece', sleep: 'Hit your sleep goal', fern: 'Get a fern in the coin shop',
      cheer: "Cheer a buddy's room", recap: 'Read your first weekly recap', streak7: '7 check-ins in a row',
    } as Readonly<Record<FirstWeekTaskKey, string>>,
    reward: (n: number, bonus: boolean) => `${n < 0 ? `−${-n}` : `+${n}`}${bonus ? ' bonus' : ''}`,
    rowSpoken: (task: string, done: boolean, n: number, bonus: boolean) =>
      `${task}, ${done ? 'done' : 'not yet'}, ${n < 0 ? `costs ${-n} coins` : `plus ${n} coins${bonus ? ' bonus' : ''}`}`,
    next: (coins: string, streak: number) => `Next: 8 × 8 · ${coins} coins and a ${streak}-day check-in streak. See the next size in Room sizes.`,
    nextSpoken: (coins: string, streak: number) => `Next: 8 by 8, ${coins} coins and a ${streak}-day check-in streak. See the next size in Room sizes.`,
    done: '✓',
    notDone: '○',
    shop: 'Coin shop',
    sizes: 'Room sizes',
  },
  welcome: {
    bubble: 'WELCOME HOME!',
    text: "This is KIP's room. Make it yours: drag pieces in, flip them, stack them.",
    coins: 'Healthy days earn coins, and coins turn into things for the room.',
    lanternName: 'A welcome lantern',
    lanternLine: 'Free · in your inventory · glows at night',
    lanternSpoken: 'A welcome lantern. Free, in your inventory, glows at night',
    place: 'Place the lantern',
    later: 'Later',
  },
  coach: {
    title: 'Your first piece',
    sub: 'Takes 10 seconds',
    step: (n: number) => `Step ${n} of 3`,
    /** Said when a new step starts: the step and what to do. */
    stepSpoken: (n: number, text: string) => `Step ${n} of 3. ${text}`,
    steps: ['Drag the lantern onto the lime tile. It snaps to the grid.', 'Now tap Turn. It faces the other way.', 'Tap Done to keep it.'] as const,
    next: ['Next: turn it, then tap Done.', 'Next: tap Done.', ''] as const,
    labels: ['Drag', 'Turn', 'Done'] as const,
    skip: 'Skip',
    place: 'Place it on the lime tile',
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
