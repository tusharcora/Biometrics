import { clampPan, dragAt, ghostRects, grabOffset, targetKey, targetOf } from '../../src/lib/room/edit/drag';
import { initEditor } from '../../src/lib/room/edit/editor';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const S = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, version: 1, newIds: [] });
const P = projOf(isoGrid(1));
const fern = { item: 'plant.fern', id: 'plant', facing: 'L' as const, mirror: false };
const bag = { item: 'corner.beanbag', id: null, facing: 'L' as const, mirror: false };

it('snaps to the tile under the point and says nothing when it fits', () => {
  expect(dragAt(S, fern, P(5.5, 5.5))).toMatchObject({ target: { layer: 'floor', x: 5, y: 5 }, refused: null });
});

it('turns red with the reason: the chair\'s exit tile, off the floor, or a full room (spec §5.3)', () => {
  expect(dragAt(S, bag, P(3.5, 2.5)).refused).toEqual({ reason: 'seat', with: 'desk' });
  expect(dragAt(S, fern, P(9, 9)).refused).toEqual({ reason: 'outside' });
  const full = { ...S, draft: { ...S.draft, layout: { ...S.draft.layout, pieces: [...S.draft.layout.pieces, ...Array.from({ length: 33 }, (_, k) => ({ id: `w${k}`, item: 'art.calendar', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }))] } } };
  expect(dragAt(full, bag, P(6.5, 6.5)).refused).toEqual({ reason: 'full' });
  expect(dragAt(full, fern, P(6.5, 6.5)).refused).toBeNull(); // moving is not adding
});

it('a wall piece over the floor says it belongs on the wall', () => {
  expect(dragAt(S, { item: 'shelf.plank', id: 'plank', facing: 'L', mirror: false }, P(4, 4)).refused).toEqual({ reason: 'layer' });
});

it('the ghost is the piece (and what stands on it) at the target, with a red copy only when refused', () => {
  const desk = { item: 'desk.monitor', id: 'desk', facing: 'L' as const, mirror: false };
  const ok = ghostRects(S, dragAt(S, desk, P(3.5, 5)), { night: false, colour: 'coral' });
  expect(ok.base.length).toBeGreaterThan(0);
  expect(ok.tint).toEqual([]);
  const bad = ghostRects(S, dragAt(S, bag, P(3.5, 2.5)), { night: false, colour: 'coral' });
  expect(bad.tint.length).toBeGreaterThan(0);
  expect(bad.tint.every((q) => q[4] === 'rgba(248,113,113,0.6)')).toBe(true);
  expect(targetKey({ layer: 'floor', x: 1, y: 2 })).toBe('floor:1:2');
});

it('the desk\'s ghost carries what stands on it (spec §3.3)', () => {
  const desk = { item: 'desk.monitor', id: 'desk', facing: 'L' as const, mirror: false };
  const bare = { ...S, draft: { ...S.draft, layout: { ...S.draft.layout, pieces: S.draft.layout.pieces.filter((p) => p.parent !== 'desk') } } };
  const at = P(3.5, 5);
  const c = { night: false, colour: 'coral' as const };
  expect(ghostRects(S, dragAt(S, desk, at), c).base.length).toBeGreaterThan(ghostRects(bare, dragAt(bare, desk, at), c).base.length);
});

it('held still, every placed piece snaps back to its own place, wherever the finger grabbed it (ruling T12-FIX)', () => {
  for (const p of S.draft.layout.pieces) {
    const base = { item: p.item, id: p.id, facing: p.facing, mirror: p.mirror };
    for (const finger of [[0, 0], [80, 40], [-3, 200]] as Array<[number, number]>) {
      const [dx, dy] = grabOffset(S, p, finger);
      const d = dragAt(S, base, [finger[0] + dx, finger[1] + dy]);
      expect([p.id, d.target, d.refused]).toEqual([p.id, targetOf(p), null]);
    }
  }
});

it('pans only as far as the room goes; a narrower room stays centred (spec §5.6)', () => {
  const g = isoGrid(3); // 440 × 368 points
  expect(clampPan({ x: 50, y: 50 }, { width: 390, height: 320 }, g)).toEqual({ x: 0, y: 0 });
  expect(clampPan({ x: -500, y: -500 }, { width: 390, height: 320 }, g)).toEqual({ x: 390 - 440, y: 320 - 368 });
  expect(clampPan({ x: -500, y: 0 }, { width: 400, height: 400 }, isoGrid(1))).toEqual({ x: 28, y: 40 });
});
