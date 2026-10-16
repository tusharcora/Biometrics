import {
  TIERS, capFor, checkPiece, coveredBy, effectPieces, effectSlotsFor, effectsRaised, exitTile, footOf, parseLayout, placedCounts,
  runningEffects, seatTile, toTier, validateLayout, windowsOn, wrongLayer, type RoomLayout,
} from '../../src/room/geometry';
import { starterLayout } from '../../src/room/convert';
import { deps, piece, withPieces } from './helpers';

const check = (layout: RoomLayout, id: string, tier: 1 | 2 | 3 = 1) => checkPiece(layout, layout.pieces.find((p) => p.id === id)!, tier, deps);

describe('footprints, the seat and the exit tile (spec §3.2, plan rulings 2 and 11)', () => {
  it('a facing-L desk covers 3 along i and 2 along j; turned, the axes swap and the back corner stays', () => {
    const iso = deps.isoOf('desk.monitor')!;
    expect(footOf({ x: 2, y: 0, facing: 'L' }, iso)).toEqual({ x0: 2, y0: 0, x1: 5, y1: 2 });
    expect(footOf({ x: 2, y: 0, facing: 'R' }, iso)).toEqual({ x0: 2, y0: 0, x1: 4, y1: 3 });
  });

  it('KIP\'s seat is on the front row and the exit tile is in front of it, for each facing', () => {
    const iso = deps.isoOf('desk.monitor')!;
    expect([seatTile(piece('d', 'desk.monitor', { x: 2 }), iso), exitTile(piece('d', 'desk.monitor', { x: 2 }), iso)]).toEqual([[3, 1], [3, 2]]);
    const r = piece('d', 'desk.monitor', { x: 0, y: 2, facing: 'R' });
    expect([seatTile(r, iso), exitTile(r, iso)]).toEqual([[1, 3], [2, 3]]);
  });
});

describe('checkPiece', () => {
  it('the starter layout is valid at every tier', () => {
    for (const tier of [1, 2, 3] as const) expect(validateLayout(starterLayout(), tier, deps)).toBeNull();
  });

  it('outside: off the 7 × 7 floor; the same desk fits the 8 × 8 room', () => {
    const l = withPieces(piece('desk', 'desk.monitor', { x: 5, y: 0 }));
    expect(check(l, 'desk', 1)).toEqual({ reason: 'outside' });
    expect(check(l, 'desk', 2)).toBeNull();
  });

  it('overlap names the other piece; a rug lies under anything but never on another rug', () => {
    expect(check(withPieces(piece('f', 'plant.fern', { x: 3, y: 0 })), 'f')).toEqual({ reason: 'overlap', with: 'desk' });
    expect(check(withPieces(piece('r2', 'rug.red', { x: 2, y: 0 })), 'r2')).toEqual({ reason: 'overlap', with: 'rug' });
    expect(check(withPieces(piece('rug', 'rug.red', { x: 2, y: 0 })), 'rug')).toBeNull(); // under the desk
  });

  it('seat: nothing but a rug may cover the desk\'s exit tile, and the exit tile must be in the room', () => {
    expect(check(withPieces(piece('b', 'corner.beanbag', { x: 3, y: 2 })), 'b')).toEqual({ reason: 'seat', with: 'desk' });
    expect(check(withPieces(piece('desk', 'desk.monitor', { x: 2, y: 5 })), 'desk')).toEqual({ reason: 'seat' });
    expect(check(starterLayout(), 'rug')).toBeNull(); // the starter rug covers (3, 2)
  });

  it('walls: inside the wall, never over a window, never over another wall piece', () => {
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallL', x: 4, y: 6 })), 'a')).toEqual({ reason: 'window' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 7, y: 9 })), 'a')).toEqual({ reason: 'wall', with: 'plank' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 12, y: 0 })), 'a')).toEqual({ reason: 'outside' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 0, y: 12 })), 'a')).toEqual({ reason: 'outside' });
  });

  it('the loft adds a right-wall window over half-tiles 12 to 16 (spec §3.2)', () => {
    expect(windowsOn('wallR', 3)).toEqual([{ x0: 12, y0: 5, x1: 17, y1: 14 }]);
    expect(windowsOn('wallR', 2)).toEqual([]);
    const l = withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 12, y: 6 }));
    expect([check(l, 'a', 3), check(l, 'a', 2)]).toEqual([{ reason: 'window' }, null]);
  });

  it('coveredBy: the wall pieces a size\'s windows cover, with what stands on them, and nothing else (spec §7, PF-F4)', () => {
    // The loft's window is half-tiles 12–16, steps 5–13. The plank (and the books on it) and one picture overlap it;
    // a picture right beside it, one right below it and one on the left wall stay.
    const l = withPieces(
      piece('plank', 'shelf.plank', { layer: 'wallR', x: 12, y: 13 }),
      piece('b', 'art.mountain', { layer: 'wallR', x: 14, y: 7 }),
      piece('a', 'art.mountain', { layer: 'wallR', x: 8, y: 6 }),
      piece('d', 'art.heart', { layer: 'wallR', x: 14, y: 1 }),
      piece('c', 'art.calendar', { layer: 'wallL', x: 0, y: 9 }),
    );
    expect([...coveredBy(l, 3, deps)].sort()).toEqual(['b', 'plank', 'shelf']);
    expect([...coveredBy(l, 2, deps)]).toEqual([]);
    expect([...coveredBy(starterLayout(), 3, deps)]).toEqual([]);
  });

  it('stacking: a free spot of a parent with a surface, one level only', () => {
    const top = (id: string, parent: string, spot: number, item = 'item.sticky') => piece(id, item, { layer: 'onTop', parent, spot });
    expect(check(withPieces(top('s', 'desk', 1)), 's')).toBeNull();
    expect(check(withPieces(top('s', 'desk', 2)), 's')).toEqual({ reason: 'spot', with: 'deskitem' });
    expect(check(withPieces(top('s', 'desk', 3)), 's')).toEqual({ reason: 'spot', with: 'desk' });
    expect(check(withPieces(top('s', 'gone', 0)), 's')).toEqual({ reason: 'parent' });
    expect(check(withPieces(top('s', 'plant', 0)), 's')).toEqual({ reason: 'parent', with: 'plant' });
    expect(check(withPieces(top('s', 'deskitem', 0)), 's')).toEqual({ reason: 'nested', with: 'deskitem' });
  });
});

describe('validateLayout (spec §12 PUT errors, in order)', () => {
  it('wrong_layer: a desk on the wall, a mug on the floor, a turned fern', () => {
    expect(validateLayout(withPieces(piece('m', 'item.mug')), 1, deps)).toEqual({ error: 'wrong_layer', pieceIds: ['m'] });
    expect(validateLayout(withPieces(piece('f', 'plant.fern', { x: 6, y: 6, facing: 'R' })), 1, deps)).toEqual({ error: 'wrong_layer', pieceIds: ['f'] });
  });

  it('bad_place names the pieces and the reason', () => {
    expect(validateLayout(withPieces(piece('f', 'plant.fern', { x: 3, y: 0 })), 1, deps)).toEqual({ error: 'bad_place', reason: 'overlap', pieceIds: ['desk', 'f'] }); // the desk is checked first
  });

  it('desk_required: exactly one kipDesk piece', () => {
    const none = { ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id !== 'desk' && p.parent !== 'desk') };
    expect(validateLayout(none, 1, deps)).toEqual({ error: 'desk_required' });
    expect(validateLayout(withPieces(piece('d2', 'desk.notebook', { x: 2, y: 4 })), 1, deps)).toEqual({ error: 'desk_required' });
  });

  it('room_full past the tier\'s cap', () => {
    const tiles: Array<[number, number]> = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!(x >= 2 && x < 5 && y < 2) && !(x === 3 && y === 2)) tiles.push([x, y]);
    const l: RoomLayout = { ...starterLayout(), pieces: [piece('desk', 'desk.monitor', { x: 2 }), ...tiles.slice(0, 40).map(([x, y], k) => piece(`f${k}`, 'plant.fern', { x, y }))] };
    expect(validateLayout(l, 1, deps)).toEqual({ error: 'room_full', cap: capFor(1) });
    expect(validateLayout(l, 2, deps)).toBeNull();
  });
});

describe('parseLayout (400 invalid_body shapes)', () => {
  it('round-trips a valid layout', () => {
    expect(parseLayout(JSON.parse(JSON.stringify(starterLayout())))).toEqual(starterLayout());
  });

  it.each([
    ['v 2', (l: any) => ({ ...l, v: 2 })],
    ['an extra key', (l: any) => ({ ...l, rooms: [] })],
    ['a missing style', (l: any) => ({ ...l, styles: { wallpaper: 'wall.plain', floor: 'floor.oakDark' } })],
    ['a bad instance id', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], id: 'Desk!' }] })],
    ['duplicate ids', (l: any) => ({ ...l, pieces: [l.pieces[0], l.pieces[0]] })],
    ['an unknown placement key', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], colour: 'red' }] })],
    ['a fractional tile', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], x: 1.5 }] })],
    ['an on-top piece without a parent', (l: any) => ({ ...l, pieces: [{ ...l.pieces[1], parent: undefined }] })],
    ['a floor piece with a spot', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], spot: 1 }] })],
    ['over 200 pieces', (l: any) => ({ ...l, pieces: Array.from({ length: 201 }, (_, k) => ({ ...l.pieces[0], id: `p${k}` })) })],
  ])('rejects %s', (_label, make) => {
    expect(parseLayout(make(JSON.parse(JSON.stringify(starterLayout()))))).toBeNull();
  });
});

describe('the shared helpers (controller ruling T2: the rules live once)', () => {
  it('wrongLayer: a layer the item can\'t use, or facing R on a one-facing item', () => {
    const fern = deps.isoOf('plant.fern')!;
    expect(wrongLayer(fern, piece('f', 'plant.fern'))).toBe(false);
    expect(wrongLayer(fern, piece('f', 'plant.fern', { layer: 'onTop' }))).toBe(false);
    expect(wrongLayer(fern, piece('f', 'plant.fern', { layer: 'wallL' }))).toBe(true);
    expect(wrongLayer(fern, piece('f', 'plant.fern', { facing: 'R' }))).toBe(true);
    expect(wrongLayer(deps.isoOf('desk.monitor')!, piece('d', 'desk.monitor', { facing: 'R' }))).toBe(false);
    expect(wrongLayer(deps.isoOf('art.mountain')!, piece('a', 'art.mountain', { layer: 'wallR' }))).toBe(false);
  });

  it('placedCounts counts placements per item', () => {
    expect(placedCounts(withPieces(piece('f2', 'plant.fern', { x: 6, y: 6 })))).toEqual({
      'desk.monitor': 1, 'lamp.amber': 1, 'item.mug': 1, 'shelf.plank': 1, 'shelf.books': 1, 'plant.fern': 2, 'rug.slate': 1,
    });
  });

  it('toTier reads 2 and 3, and anything else as the starter room', () => {
    expect([2, 3, 1, 4, 0, '2', null, undefined, 2.5].map(toTier)).toEqual([2, 3, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('effect slots (spec §7, §8.1, plan ruling 4)', () => {
  const clock = (id: string, layer: 'wallL' | 'wallR', x: number) => piece(id, 'art.clock', { layer, x, y: 0 });

  it('each tier runs 3, 5 or 8 effects', () => {
    expect(([1, 2, 3] as const).map((t) => effectSlotsFor(t))).toEqual([3, 5, 8]);
    expect([TIERS[1].effects, TIERS[2].effects, TIERS[3].effects]).toEqual([3, 5, 8]);
  });

  it('lists the effect pieces first placed first: any non-p id first, then p<n> by n (p2 before p10)', () => {
    const l = withPieces(clock('p10', 'wallR', 0), clock('p2', 'wallR', 10), clock('art', 'wallL', 0), piece('p1', 'plant.cactus', { x: 6, y: 6 }));
    expect(effectPieces(l, deps).map((p) => p.id)).toEqual(['art', 'p2', 'p10']);
  });

  it('runs the first slots and leaves the rest inert', () => {
    const l = withPieces(clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0), clock('p4', 'wallL', 9));
    expect([...runningEffects(l, 1, deps)].sort()).toEqual(['p1', 'p2', 'p3']);
    expect([...runningEffects(l, 2, deps)].sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('a save raises the effects only with more than the slots and more than before (spec §8.1)', () => {
    const three = withPieces(clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0));
    const four = withPieces(...three.pieces.filter((p) => p.item === 'art.clock'), clock('p4', 'wallL', 9));
    expect(effectsRaised(three, four, 1, deps)).toBe(true);
    expect(effectsRaised(four, four, 1, deps)).toBe(false); // an older room keeps its extras
    expect(effectsRaised(four, three, 1, deps)).toBe(false);
    expect(effectsRaised(three, four, 2, deps)).toBe(false); // 4 of 5 fits the bigger room
    expect(validateLayout(four, 1, deps)).toBeNull(); // the slots are not a placement rule
  });
});
