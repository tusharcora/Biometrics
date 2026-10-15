import { CATALOGUE } from '../../src/lib/room/catalogue';
import { childrenOf, deskOf, inventoryOf, layoutKey, newPieceId, placedCounts, readLayout, starterLayout } from '../../src/lib/room/layout';

it('the starter layout is a fresh copy of the server\'s', () => {
  const a = starterLayout();
  a.pieces.pop();
  expect(starterLayout()).toEqual(CATALOGUE.starterLayout);
});

it('reads a layout, or the starter one when the value is not a layout', () => {
  expect(readLayout(CATALOGUE.starterLayout)).toEqual(CATALOGUE.starterLayout);
  expect(readLayout({ v: 2 })).toEqual(CATALOGUE.starterLayout);
});

it('counts placed copies and what is left in the inventory, never below zero', () => {
  const l = starterLayout();
  expect(placedCounts(l)['plant.fern']).toBe(1);
  expect(inventoryOf({ 'plant.fern': 3, 'plant.cactus': 1, 'rug.slate': 1 }, l)).toEqual({ 'plant.fern': 2, 'plant.cactus': 1, 'rug.slate': 0 });
});

it('finds the desk and its children in spot order', () => {
  const l = starterLayout();
  expect(deskOf(l)!.id).toBe('desk');
  expect(childrenOf(l, 'desk').map((p) => p.id)).toEqual(['lamp', 'deskitem']);
});

it('makes the lowest unused p-id, and keys a layout by its content, not its order', () => {
  const l = starterLayout();
  expect(newPieceId(l)).toBe('p1');
  const withP1 = { ...l, pieces: [...l.pieces, { ...l.pieces[0]!, id: 'p1' }] };
  expect(newPieceId(withP1)).toBe('p2');
  expect(layoutKey({ ...l, pieces: [...l.pieces].reverse() })).toBe(layoutKey(l));
  expect(layoutKey({ ...l, pieces: l.pieces.map((p) => (p.id === 'plant' ? { ...p, mirror: true } : p)) })).not.toBe(layoutKey(l));
});
