// The piece card (spec 2026-10-15 §8.1, F7; P3 rulings 16-18), pure: what a tapped effect piece or plant is, where it
// goes, how it was earned (or the coin shop and its price), what it does, how it is now (the living room's words, never
// advice), whether it rests, and whether it has a sound switch. Also what a tap on the room does, and the room image's
// actions for a screen reader. Every string comes from ROOM_COPY (PF3-COPY).
import { whereLine } from '../coins/shop';
import { GEOMETRY_DEPS, catalogueItem } from './catalogue';
import { isPlantItem as isPlant, roomEffects, type ClockNow, type Living, type PetEnergy, type RoomEffects } from './effects';
import { lowerName } from './edit/labels';
import type { GeometryDeps, RoomLayout, Tier } from './iso/geometry';
import { ROOM_COPY, coinCount, itemName, spokenName, unlockLine, unlockSpoken } from './roomCopy';

export interface PieceCardModel {
  id: string;
  item: string;
  name: string;
  nameSpoken: string;
  where: { text: string; spoken: string };
  earned: { text: string; spoken: string };
  /** What it does (an effect piece's line, a plant's); null for anything else. */
  effect: string | null;
  /** How it is now: the plant's growth, the cat's mood, the shelf's awards. */
  state: string | null;
  /** An effect piece past the room's slots (ruling 5). */
  resting: string | null;
  /** The radio: the card shows the sound switch (spec §8.2). */
  sound: boolean;
}

const E = ROOM_COPY.effects;
const C = ROOM_COPY.card;

export function pieceCard(layout: RoomLayout, tier: Tier, living: Living, now: ClockNow | null, id: string, deps: GeometryDeps = GEOMETRY_DEPS): PieceCardModel | null {
  const p = layout.pieces.find((q) => q.id === id);
  const item = p ? catalogueItem(p.item) : undefined;
  if (!p || !item?.iso) return null;
  const effects = roomEffects(layout, tier, living, now, deps);
  const kind = deps.isoOf(p.item)?.effect;
  const plant = isPlant(p.item);
  const running = effects.running.has(p.id);
  const earned = item.unlock.kind === 'shop' && item.price !== undefined
    ? { text: C.earned(unlockLine(item.unlock), coinCount(item.price)), spoken: C.earnedSpoken(unlockSpoken(item.unlock), coinCount(item.price)) }
    : { text: unlockLine(item.unlock), spoken: unlockSpoken(item.unlock) };
  const name = itemName(p.item);
  let state: string | null = null;
  // Stage 5 says no count: every pre-P3 room and the neutral fallback are stage 5 whatever the nights (FINAL-FIX I1).
  if (plant) state = living.plantStage === 5 ? E.grown(lowerName(name)) : living.plantStage > 1 ? E.grew(lowerName(name), (living.plantStage - 1) * 7) : E.sprout(lowerName(name));
  else if (kind === 'wander' && running) state = E.pet[(effects.states.get(p.id) as PetEnergy | undefined) ?? 'wander'];
  else if (kind === 'awards' && running) state = E.awardCount(Math.min(8, living.awards.length));
  return {
    id: p.id, item: p.item, name, nameSpoken: spokenName(p.item), where: whereLine(p.item), earned,
    effect: kind ? E.lines[kind] : plant ? E.plant : null,
    state,
    resting: kind && !running ? E.resting(effects.slots) : null,
    sound: kind === 'sound',
  };
}

export type PieceTap = 'card' | 'squash' | 'none';

/** What a tap on a piece does in view mode (rulings 16-17): a running tap piece squashes, an effect piece or a plant
 * opens its card, anything else does nothing (a tap on KIP reaches the piece behind it: T13-TAP). */
export function pieceTap(layout: RoomLayout, id: string, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS): PieceTap {
  const p = layout.pieces.find((q) => q.id === id);
  if (!p) return 'none';
  const kind = deps.isoOf(p.item)?.effect;
  if (kind === 'tap') return effects.running.has(p.id) ? 'squash' : 'card';
  return kind || isPlant(p.item) ? 'card' : 'none';
}

/** The room image's custom actions (spec §5.7: the room stays one image), one per card, plants first, then by id. */
export function cardPieces(layout: RoomLayout, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS): Array<{ id: string; label: string }> {
  return layout.pieces
    .filter((p) => pieceTap(layout, p.id, effects, deps) === 'card')
    .sort((a, b) => Number(!!deps.isoOf(a.item)?.effect) - Number(!!deps.isoOf(b.item)?.effect) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => ({ id: p.id, label: C.open(spokenName(p.item)) }));
}
