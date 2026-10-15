import { starterLayout } from '../../src/lib/room/layout';
import { lowerName, outcomeText, pieceLabel, pieceNoun, reasonText, toolLine, whereText } from '../../src/lib/room/edit/labels';
import { editorReducer, initEditor, selectedTools } from '../../src/lib/room/edit/editor';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const L = starterLayout();
const p = (id: string) => L.pieces.find((q) => q.id === id)!;

it('says where a piece is: on the floor, on the wall, on its parent (the desk is "the desk")', () => {
  expect([whereText(L, p('plant')), whereText(L, p('plank')), whereText(L, p('lamp')), whereText(L, p('shelf'))])
    .toEqual(['on the floor', 'on the wall', 'on the desk', 'on the wall plank']);
  expect([pieceNoun('desk.monitor'), pieceNoun('lamp.amber'), lowerName('KIP-colour lamp'), lowerName('“SLEEP IS A SKILL” poster')])
    .toEqual(['desk', 'amber desk lamp', 'KIP-colour lamp', '“SLEEP IS A SKILL” poster']);
});

it('labels a piece in the pieces list with its tile (counting from 1), never with "·" (spec §5.7)', () => {
  expect(pieceLabel(L, p('plant'))).toBe('Fern, on the floor, tile 1, 1');
  expect(pieceLabel(L, p('lamp'))).toBe('Amber desk lamp, on the desk');
  for (const q of L.pieces) expect(pieceLabel(L, q)).not.toMatch(/[·−]/);
});

it('gives each refusal a short reason (ruling 12)', () => {
  expect([
    reasonText({ reason: 'outside' }, 'plant.fern'), reasonText({ reason: 'seat', with: 'desk' }, 'plant.fern'),
    reasonText({ reason: 'overlap', with: 'desk' }, 'plant.fern', L), reasonText({ reason: 'window' }, 'art.mountain'),
    reasonText({ reason: 'full' }, 'plant.fern'), reasonText({ reason: 'layer' }, 'item.mug'), reasonText({ reason: 'layer' }, 'corner.beanbag'),
    reasonText({ reason: 'layer' }, 'art.mountain'), reasonText({ reason: 'layer' }, 'plant.fern'), reasonText({ reason: 'spot' }, 'item.mug'),
  ]).toEqual([
    "Doesn't fit here", "Blocks KIP's chair", 'Overlaps the desk', 'Covers the window', 'Room is full', 'Only on a desk or shelf',
    'Only on the floor', 'Only on the wall', 'Only on the floor or a surface', 'That spot is taken',
  ]);
});

it('the toolbar line: name, where, what is on it, and the inventory count', () => {
  const s = editorReducer(initEditor({ layout: L, worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] }), { type: 'select', id: 'plank' });
  expect(toolLine(L, selectedTools(s)!)).toEqual({ text: 'Wall plank · on the wall · 1 on it', inventory: '×0 in inventory', spoken: 'Wall plank, on the wall, 1 on it. 0 in inventory' });
});

it('says what the last action did (ruling UI-OUTCOMES): a refusal\'s reason, an applied set, nothing for a plain success', () => {
  const s = initEditor({ layout: L, worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
  expect(outcomeText(s)).toBeNull();
  expect(outcomeText({ ...s, outcome: { ok: true, id: 'plant' } })).toBeNull();
  expect(outcomeText({ ...s, outcome: { ok: false, refused: { reason: 'overlap', with: 'desk' }, id: 'plant' } }))
    .toEqual({ kind: 'reason', text: 'Overlaps the desk' });
  // A refused new piece is named by what was picked: the mug only goes on a surface.
  expect(outcomeText({ ...s, picked: 'item.mug', outcome: { ok: false, refused: { reason: 'layer' }, id: null } }))
    .toEqual({ kind: 'reason', text: 'Only on a desk or shelf' });
  expect(outcomeText({ ...s, outcome: { ok: true, id: null, applied: { setId: 'cottage', missing: ['set.cottage.desk', 'set.cottage.pet'], deskKept: true } } }))
    .toEqual({ kind: 'info', text: 'Cottage set applied. Not yours yet: Farmhouse table, Dog in a pet bed. Your desk stayed.' });
});
