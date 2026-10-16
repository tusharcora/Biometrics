// The living room on the app's side (spec 2026-10-15 §8): which effect pieces run (the first slots by instance id,
// geometry's one rule) and which rest, and each piece's effect state, the key its art is drawn and cached by (P3
// ruling 7): 'lit' (the lamp's pool), 'notes' (the radio), 'live@HH:MM' (the clock), 'a543' (the shelf's awards),
// 'nap' | 'wander' | 'play' (the cat), 'g1'-'g4' (growing plants), 'squash1' | 'squash2' (a tapped piece). An inert
// piece has no state and draws as plain decor (ruling 5). `living` is the server's bands (Task 3); the 22:00 nap is the
// device clock's (ruling 6). Nothing here is sent anywhere: not to buddies, not to the coach.
import { GEOMETRY_DEPS, catalogueItem } from './catalogue';
import { effectPieces, effectSlotsFor, firstPlaced, type EffectKind, type GeometryDeps, type Placement, type RoomLayout, type Tier } from './iso/geometry';

export type PetEnergy = 'nap' | 'wander' | 'play';
export interface Living {
  plantStage: 1 | 2 | 3 | 4 | 5;
  petEnergy: PetEnergy;
  /** Badge levels, highest first, at most 8. */
  awards: readonly number[];
}
/** Nothing health-linked: plants grown, the cat wandering, the shelf empty (spec §10.1). A visit and the share card draw
 * it (P4); so does an older server's body. */
export const NEUTRAL_LIVING: Living = { plantStage: 5, petEnergy: 'wander', awards: [] };

const isStage = (v: unknown): v is Living['plantStage'] => v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
const isEnergy = (v: unknown): v is PetEnergy => v === 'nap' || v === 'wander' || v === 'play';

export function readLiving(v: unknown): Living {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  if (!o || !isStage(o.plantStage) || !isEnergy(o.petEnergy) || !Array.isArray(o.awards)) return NEUTRAL_LIVING;
  const awards = o.awards as unknown[];
  if (awards.length > 8 || !awards.every((a) => a === 1 || a === 2 || a === 3 || a === 4 || a === 5)) return NEUTRAL_LIVING;
  return { plantStage: o.plantStage, petEnergy: o.petEnergy, awards: awards as number[] };
}

export const livingKey = (l: Living): string => `${l.plantStage}${l.petEnergy}${l.awards.join('')}`;

/** The device's local time, read once a minute (Task 5's useClockMinute). */
export interface ClockNow { hhmm: string; hour: number }
/** The cat always naps from 22:00 to 05:59 local (spec §8.3, ruling 6). */
export const NAP_FROM = 22;
export const NAP_UNTIL = 6;
export const isNapHour = (hour: number): boolean => hour >= NAP_FROM || hour < NAP_UNTIL;

export interface RoomEffects {
  /** Placement ids whose effect runs. */
  running: ReadonlySet<string>;
  /** Effect pieces past the slots: placed, drawn plain, doing nothing. */
  inert: ReadonlySet<string>;
  /** Running effects, for "Effects 3 of 5". */
  used: number;
  slots: number;
  /** Placement id → effect state (only pieces that have one). */
  states: ReadonlyMap<string, string>;
  /** A napping cat's id → the pet bed it lies on. */
  napOn: ReadonlyMap<string, string>;
  /** A plant is in the room: KIP's smile frame (ruling 9). */
  plant: boolean;
  /** A running clock or cat reads the time. */
  needsClock: boolean;
}

export function effectOf(item: string, deps: GeometryDeps = GEOMETRY_DEPS): EffectKind | undefined {
  return deps.isoOf(item)?.effect;
}

const isPlant = (p: Placement) => catalogueItem(p.item)?.slot === 'plant';

export function roomEffects(layout: RoomLayout, tier: Tier, living: Living, now: ClockNow | null, deps: GeometryDeps = GEOMETRY_DEPS): RoomEffects {
  const list = effectPieces(layout, deps);
  const slots = effectSlotsFor(tier);
  const running = new Set(list.slice(0, slots).map((p) => p.id));
  const inert = new Set(list.slice(slots).map((p) => p.id));
  const states = new Map<string, string>();
  const napOn = new Map<string, string>();
  // A napping cat takes the first free bed in geometry's one order (PF3-RANK).
  const beds = layout.pieces.filter((p) => p.layer === 'floor' && p.item === 'pet.bed').sort(firstPlaced);
  let needsClock = false;
  for (const p of list) {
    if (!running.has(p.id)) continue;
    switch (deps.isoOf(p.item)!.effect) {
      case 'light': states.set(p.id, 'lit'); break;
      case 'sound': states.set(p.id, 'notes'); break;
      case 'awards': states.set(p.id, `a${living.awards.slice(0, 8).join('')}`); break;
      case 'clock':
        needsClock = true;
        if (now) states.set(p.id, `live@${now.hhmm}`);
        break;
      case 'wander': {
        needsClock = true;
        const state: PetEnergy = now && isNapHour(now.hour) ? 'nap' : living.petEnergy;
        states.set(p.id, state);
        const bed = state === 'nap' && p.layer === 'floor' ? beds.shift() : undefined;
        if (bed) napOn.set(p.id, bed.id);
        break;
      }
      case 'tap':
      case undefined:
        break;
    }
  }
  if (living.plantStage < 5) for (const p of layout.pieces) if (isPlant(p)) states.set(p.id, `g${living.plantStage}`);
  return { running, inert, used: running.size, slots, states, napOn, plant: layout.pieces.some(isPlant), needsClock };
}

/** The effect part of the static room's key (isoRoomKey). */
export function effectsKey(e: RoomEffects): string {
  const states = [...e.states].map(([id, s]) => `${id}=${s}`).sort().join(',');
  const naps = [...e.napOn].map(([cat, bed]) => `${cat}>${bed}`).sort().join(',');
  return `${states}|${naps}`;
}

/** The same effects with one piece's state set (a tap's squash, Task 13). */
export function withState(e: RoomEffects, id: string, state: string): RoomEffects {
  const states = new Map(e.states);
  states.set(id, state);
  return { ...e, states };
}
