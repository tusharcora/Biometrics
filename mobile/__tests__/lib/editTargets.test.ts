import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { coachRects } from '../../src/lib/room/edit/overlay';
import { coachTile, nearestFree, placedAt, refusal, roomCentre, snapTarget, targetPoint } from '../../src/lib/room/edit/targets';

const g = isoGrid(1);
const P = projOf(g);
const fern = (over: Partial<Placement> = {}): Placement => ({ id: 'p1', item: 'plant.fern', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false, ...over });

describe('snapTarget (spec §5.3 Snap)', () => {
  it('snaps a floor piece to the tile under the point, a desk by its footprint\'s centre', () => {
    expect(snapTarget(g, starterLayout(), 'plant.fern', P(4.5, 5.5), 'L', null)).toEqual({ layer: 'floor', x: 4, y: 5 });
    expect(snapTarget(g, starterLayout(), 'desk.notebook', P(3.5, 5), 'L', 'desk')).toEqual({ layer: 'floor', x: 2, y: 4 });
  });

  it('snaps a poster to the wall grid: half tiles along, 4-cell steps up', () => {
    expect(snapTarget(g, starterLayout(), 'art.mountain', P(3, 0, 40), 'L', null)).toEqual({ layer: 'wallR', x: 4, y: 8 });
    expect(snapTarget(g, starterLayout(), 'art.mountain', P(0, 5, 40), 'L', null)).toEqual({ layer: 'wallL', x: 8, y: 8 });
  });

  it('snaps an on-top piece to the nearest free spot near the point ("a mug snaps onto the desk")', () => {
    expect(snapTarget(g, starterLayout(), 'item.sticky', P(3.5, 0.6, 22), 'L', null)).toEqual({ layer: 'onTop', parent: 'desk', spot: 1 });
    // Spot 2 holds the mug: a point on it finds spot 1 (still within reach) or nothing.
    expect(snapTarget(g, starterLayout(), 'item.sticky', P(1, 6), 'L', null)).toBeNull();
  });
});

describe('refusal (spec §5.3 Invalid)', () => {
  it('names the layer, the cap and the geometry reason', () => {
    expect(refusal(starterLayout(), fern({ item: 'item.mug' }), 1, false)).toEqual({ reason: 'layer' });
    expect(refusal(starterLayout(), fern({ x: 3, y: 2 }), 1, false)).toEqual({ reason: 'seat', with: 'desk' });
    expect(refusal(starterLayout(), fern(), 1, false)).toBeNull();
    const full = { ...starterLayout(), pieces: [...starterLayout().pieces, ...Array.from({ length: 33 }, (_, k) => fern({ id: `q${k}`, layer: 'wallR', x: 0, y: 0 }))] };
    expect(refusal(full, fern(), 1, true)).toEqual({ reason: 'full' });
  });

  it('builds a placement for a target, dropping parent and spot off a surface', () => {
    const top = placedAt({ id: 'm', item: 'item.mug', facing: 'L', mirror: false }, { layer: 'onTop', parent: 'desk', spot: 1 });
    expect(top).toEqual({ id: 'm', item: 'item.mug', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 1 });
    expect(placedAt(top, { layer: 'floor', x: 1, y: 1 })).toEqual({ id: 'm', item: 'item.mug', layer: 'floor', x: 1, y: 1, facing: 'L', mirror: false });
  });
});

describe('nearestFree (spec §5.4 Place)', () => {
  it('finds the free valid place nearest the room\'s centre, and nothing when nothing fits', () => {
    const t = nearestFree(g, starterLayout(), 'plant.cactus', 1, roomCentre(g), { id: 'p1', item: 'plant.cactus', facing: 'L', mirror: false })!;
    expect(refusal(starterLayout(), placedAt({ id: 'p1', item: 'plant.cactus', facing: 'L', mirror: false }, t), 1, false)).toBeNull();
    const d = (q: typeof t) => Math.hypot(...targetPoint(g, starterLayout(), 'plant.cactus', q, 'L').map((v, k) => v - roomCentre(g)[k]!) as [number, number]);
    expect(d(t)).toBeLessThan(20);
    expect(nearestFree(g, starterLayout(), 'item.sticky', 1, roomCentre(g), { id: 'p1', item: 'item.sticky', facing: 'L', mirror: false })).toEqual({ layer: 'onTop', parent: 'desk', spot: 1 });
  });

  it('the coach tile is (5, 3) when it is free, else the nearest free tile to it (ruling 19)', () => {
    expect(coachTile(g, starterLayout(), 1)).toEqual([5, 3]);
    const taken = { ...starterLayout(), pieces: [...starterLayout().pieces, fern({ x: 5, y: 3 })] };
    const [x, y] = coachTile(g, taken, 1);
    expect(Math.abs(x - 5) + Math.abs(y - 3)).toBe(1);
  });

  it('the lime tile is a lime-edged diamond on that tile, in whole cells (C7)', () => {
    const r = coachRects(g, [5, 3]);
    const lime = r.filter((c) => c[4] === '#A3E635');
    expect(lime.length).toBeGreaterThan(0);
    expect(r.some((c) => c[4] === 'rgba(163,230,53,0.4)')).toBe(true);
    expect(r.every((c) => c.slice(0, 4).every(Number.isInteger))).toBe(true);
    const [cx, cy] = P(5.5, 3.5);
    const xs = lime.map((c) => c[0]);
    const ys = lime.map((c) => c[1]);
    expect(Math.min(...xs) < cx && cx < Math.max(...xs) && Math.min(...ys) < cy && cy < Math.max(...ys)).toBe(true);
  });
});
