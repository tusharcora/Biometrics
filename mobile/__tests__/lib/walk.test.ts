import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { kipTileCell } from '../../src/lib/room/iso/movers';
import { blockedTiles, bfs, headsLeft, planTrip, posAt, standTileOf, tileInView, walkTargets, USE_POSE } from '../../src/lib/room/live/walk';
import { starterLayout } from '../../src/lib/room/layout';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const WHOLE = { x: -1000, y: -1000, w: 3000, h: 3000 };
const fx = (l: RoomLayout) => roomEffects(l, 1, NEUTRAL_LIVING, null);

describe('use tiles (spec §9.2)', () => {
  it('a floor piece: the free tile in front of its facing side, the middle first', () => {
    const l = room(at('p1', 'corner.beanbag', { x: 5, y: 3 }));
    const blocked = blockedTiles(l);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p1')!, 1, blocked)).toEqual([5, 4]);
    expect(standTileOf(l, { ...l.pieces.find((p) => p.id === 'p1')!, facing: 'R' }, 1, blocked)).toEqual([6, 3]);
  });

  it('a wall piece: the floor tile against its wall under its centre; an on-top piece: its parent\'s', () => {
    const l = room(at('p1', 'art.clock', { layer: 'wallR', x: 10, y: 0 }), at('p2', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }));
    const blocked = blockedTiles(l);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p1')!, 1, blocked)).toEqual([5, 0]);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p2')!, 1, blocked)).toEqual([3, 2]); // the desk's front, its exit tile
  });

  it('rugs never block; footprints do', () => {
    const blocked = blockedTiles(starterLayout());
    expect([blocked.has('2,0'), blocked.has('0,0'), blocked.has('2,3')]).toEqual([true, true, false]); // desk, fern, the rug
  });
});

describe('paths and targets (spec §9.2, ruling 13)', () => {
  it('finds a shortest path round the furniture, and none into a closed corner', () => {
    const blocked = new Set(['1,0', '1,1', '0,1']);
    expect(bfs([3, 3], [0, 0], 7, 7, blocked)).toBeNull();
    expect(bfs([3, 2], [3, 5], 7, 7, new Set())).toEqual([[3, 2], [3, 3], [3, 4], [3, 5]]);
  });

  it('targets the running effect pieces and the plants, never an inert or a wandering one, only inside the view', () => {
    // Every other tile, so each lamp's front tile is free; p4 at the back of the room rests anyway (ruling 5).
    const lamps = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'corner.floorlamp', { x: 6, y: 2 * k }));
    const l = room(...lamps);
    const ids = walkTargets(l, 1, fx(l), WHOLE).map((t) => t.id).sort();
    expect(ids).toEqual(['p1', 'p2', 'p3', 'plant']);
    expect(walkTargets(l, 1, fx(l), { x: 0, y: 0, w: 1, h: 1 })).toEqual([]);
    const cat = room(at('p9', 'pet.tabby', { x: 5, y: 5 }));
    expect(walkTargets(cat, 1, roomEffects(cat, 1, { ...NEUTRAL_LIVING, petEnergy: 'wander' }, { hhmm: '12:00', hour: 12 }), WHOLE).some((t) => t.id === 'p9')).toBe(false);
    expect(walkTargets(cat, 1, roomEffects(cat, 1, { ...NEUTRAL_LIVING, petEnergy: 'play' }, { hhmm: '12:00', hour: 12 }), WHOLE).find((t) => t.id === 'p9')!.kind).toBe('cat');
  });

  it('a napping cat curled on its bed is visited at the bed, where it is drawn (ruling 10)', () => {
    const l = room(at('p9', 'pet.tabby', { x: 5, y: 5 }), at('p8', 'pet.bed', { x: 1, y: 4 }));
    const napping = walkTargets(l, 1, roomEffects(l, 1, NEUTRAL_LIVING, { hhmm: '23:00', hour: 23 }), WHOLE).find((t) => t.id === 'p9')!;
    const bed = l.pieces.find((p) => p.id === 'p8')!;
    expect(napping.stand).toEqual(standTileOf(l, bed, 1, blockedTiles(l)));
    expect(napping.stand).not.toEqual(standTileOf(l, l.pieces.find((p) => p.id === 'p9')!, 1, blockedTiles(l)));
  });

  it('a trip leaves from the seat by the exit tile, and never goes to the same piece twice in a row', () => {
    const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 5 }));
    const trip = planTrip(l, 1, fx(l), WHOLE, null, () => 0)!;
    expect(trip.path.slice(0, 2)).toEqual([[3, 1], [3, 2]]);
    const again = planTrip(l, 1, fx(l), WHOLE, trip.target.id, () => 0)!;
    expect(again.target.id).not.toBe(trip.target.id);
    expect(planTrip({ ...l, pieces: l.pieces.filter((p) => p.id !== 'plant' && p.id !== 'p1') }, 1, fx(l), WHOLE, null, () => 0)).toBeNull();
  });

  it('with one target, or no path to the others, the last target comes back (ruling T10-ONE)', () => {
    const fern = starterLayout();
    expect(planTrip(fern, 1, fx(fern), WHOLE, 'plant', () => 0)!.target.id).toBe('plant');
    // A lamp whose front tile is walled in by two bean bags: no path to it, so the fern again.
    const boxed = room(at('p1', 'corner.floorlamp', { x: 0, y: 2 }), at('p2', 'corner.beanbag', { x: 1, y: 3 }), at('p3', 'corner.beanbag', { x: 0, y: 4 }));
    expect(walkTargets(boxed, 1, fx(boxed), WHOLE).map((t) => t.id).sort()).toEqual(['p1', 'plant']);
    expect(planTrip(boxed, 1, fx(boxed), WHOLE, 'plant', () => 0)!.target.id).toBe('plant');
  });

  it('walks only over tiles inside the crop: a target in view with its way out of the view is not taken', () => {
    const l = room(at('p1', 'corner.floorlamp', { x: 5, y: 2 }));
    const g = isoGrid(1);
    expect(planTrip(l, 1, fx(l), WHOLE, 'plant', () => 0)!.target.id).toBe('p1');
    // A crop just big enough for KIP at the lamp: the lamp is a target, but the seat's way out is outside the view.
    const [x, y] = kipTileCell(g, [5, 3]);
    const lampOnly = { x, y, w: 32, h: 32 };
    expect(walkTargets(l, 1, fx(l), lampOnly).map((t) => t.id)).toEqual(['p1']);
    expect(planTrip(l, 1, fx(l), lampOnly, null, () => 0)).toBeNull();
    // In the page's crop every tile of the trip is in view.
    const card = { x: 10.5, y: 19, w: 161.5, h: 120 };
    const trip = planTrip(l, 1, fx(l), card, null, () => 0)!;
    expect(trip.path.slice(1).every((t) => tileInView(g, t, card))).toBe(true);
  });

  it('glides half a tile a frame, taking its depth from the tile it is moving into', () => {
    const path = [[3, 1], [3, 2], [4, 2]] as const;
    expect(posAt(path, 0, 1)).toEqual({ pos: [3, 1], depth: [3, 1] });
    expect(posAt(path, 1, 1)).toEqual({ pos: [3, 1.5], depth: [3, 2] });
    expect(posAt(path, 3, -1)).toEqual({ pos: [3.5, 2], depth: [3, 2] });
    expect([headsLeft([3, 2], [4, 2]), headsLeft([3, 2], [3, 3])]).toEqual([false, true]);
    expect(USE_POSE).toEqual({ sound: 'rest', plant: 'water', cat: 'wave', other: 'point' });
    expect(tileInView(isoGrid(1), [3, 3], WHOLE)).toBe(true);
  });
});
