import { GEOMETRY_DEPS } from '../../src/lib/room/catalogue';
import { NEUTRAL_LIVING, effectsKey, isNapHour, readLiving, roomEffects, withState, type Living } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const clock = (id: string, layer: 'wallL' | 'wallR', x: number) => at(id, 'art.clock', { layer, x });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const LIVING: Living = { plantStage: 3, petEnergy: 'play', awards: [5, 4, 3] };
const DAY = { hhmm: '07:12', hour: 7 };
const NIGHT = { hhmm: '23:05', hour: 23 };

describe('roomEffects (spec §8.1, §8.3, P3 rulings 4-6)', () => {
  it('runs the first slots by instance id, and the rest rest (Review Focus 1)', () => {
    const e = roomEffects(room(clock('p4', 'wallL', 9), clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0)), 1, LIVING, DAY);
    expect([[...e.running].sort(), [...e.inert], e.used, e.slots]).toEqual([['p1', 'p2', 'p3'], ['p4'], 3, 3]);
    expect([e.states.get('p1'), e.states.get('p4')]).toEqual(['live@07:12', undefined]);
    expect(e.needsClock).toBe(true);
  });

  it('gives each running piece its state: the lamp lit, the radio\'s notes, the shelf\'s awards', () => {
    const e = roomEffects(room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }), at('p2', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }), at('p3', 'shelf.awards', { layer: 'wallR', x: 0, y: 12 })), 1, LIVING, null);
    expect(Object.fromEntries(e.states)).toEqual({ p1: 'lit', p2: 'notes', p3: 'a543', plant: 'g3' });
    expect(e.needsClock).toBe(false);
  });

  it('grows every plant to the room\'s one stage; stage 5 is the plain plant; a plant is the room\'s mood', () => {
    const l = room(at('p1', 'plant.cactus', { x: 6, y: 6 }));
    expect([roomEffects(l, 1, LIVING, null).states.get('p1'), roomEffects(l, 1, LIVING, null).states.get('plant')]).toEqual(['g3', 'g3']);
    expect(roomEffects(l, 1, NEUTRAL_LIVING, null).states.size).toBe(0);
    expect(roomEffects(l, 1, LIVING, null).plant).toBe(true);
    expect(roomEffects({ ...l, pieces: l.pieces.filter((p) => !p.item.startsWith('plant.')) }, 1, LIVING, null).plant).toBe(false);
  });

  it('the cat follows the steps band by day, and naps on the first free bed by id after 22:00', () => {
    const l = room(at('p1', 'pet.tabby', { x: 6, y: 6 }), at('p3', 'pet.bed', { x: 5, y: 6 }), at('p2', 'pet.bed', { x: 4, y: 6 }));
    const day = roomEffects(l, 1, LIVING, DAY);
    expect([day.states.get('p1'), day.napOn.size]).toEqual(['play', 0]);
    const night = roomEffects(l, 1, LIVING, NIGHT);
    expect([night.states.get('p1'), night.napOn.get('p1')]).toEqual(['nap', 'p2']);
    expect([isNapHour(21), isNapHour(22), isNapHour(5), isNapHour(6)]).toEqual([false, true, true, false]);
    expect(roomEffects(room(at('p1', 'pet.tabby', { x: 6, y: 6 })), 1, LIVING, NIGHT).napOn.size).toBe(0); // no bed: curled on its tile
  });

  it('an inert piece has no state at all: it draws as plain decor (ruling 5)', () => {
    const lamps = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'corner.floorlamp', { x: 6, y: 3 + k }));
    expect(roomEffects(room(...lamps), 1, LIVING, null).states.has('p4')).toBe(false);
  });

  it('a tap piece runs with no state until it is tapped (ruling 17; injected, since the duck is B2)', () => {
    const deps = { isoOf: (id: string) => (id === 'item.mug' ? { ...GEOMETRY_DEPS.isoOf(id)!, effect: 'tap' as const } : GEOMETRY_DEPS.isoOf(id)) };
    const e = roomEffects(starterLayout(), 1, NEUTRAL_LIVING, null, deps);
    expect([e.running.has('deskitem'), e.states.has('deskitem')]).toEqual([true, false]);
    expect(withState(e, 'deskitem', 'squash1').states.get('deskitem')).toBe('squash1');
    expect(effectsKey(withState(e, 'deskitem', 'squash1'))).not.toBe(effectsKey(e));
  });

  it('reads a living body, and anything else as the neutral room', () => {
    expect(readLiving({ plantStage: 2, petEnergy: 'nap', awards: [3, 1] })).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [3, 1] });
    for (const bad of [undefined, null, {}, { plantStage: 6, petEnergy: 'nap', awards: [] }, { plantStage: 2, petEnergy: 'run', awards: [] }, { plantStage: 2, petEnergy: 'nap', awards: [9] }]) {
      expect(readLiving(bad)).toEqual(NEUTRAL_LIVING);
    }
  });
});
