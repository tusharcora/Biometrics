import { EMPTY_WORN } from '../../src/lib/room/loadout';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { childrenOf, starterLayout } from '../../src/lib/room/layout';
import { canPlace, displayDraft, editorReducer, initEditor, inventory, isChanged, selectedTools, UNDO_STEPS, type EditorAction, type EditorState } from '../../src/lib/room/edit/editor';
import { movedText, nudgeAnnouncement, outcomeText } from '../../src/lib/room/edit/labels';
import { putOnOptions } from '../../src/lib/room/edit/targets';
import { catalogueSet } from '../../src/lib/room/catalogue';

const COUNTS: Record<string, number> = {
  'desk.monitor': 1, 'desk.notebook': 1, 'lamp.amber': 1, 'item.mug': 1, 'item.sticky': 1, 'shelf.books': 1, 'shelf.plank': 1,
  'plant.fern': 3, 'plant.cactus': 1, 'rug.slate': 1, 'lamp.welcome': 1, 'corner.beanbag': 1, 'wall.plain': 1, 'wall.dots': 1,
  'floor.oakDark': 1, 'win.plain': 1, 'out.beanie': 1, 'art.calendar': 1,
};
const start = (over: Partial<Parameters<typeof initEditor>[0]> = {}, open?: Parameters<typeof initEditor>[1]) =>
  initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: COUNTS, version: 3, newIds: [], ...over }, open);
const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const piece = (s: EditorState, id: string) => s.draft.layout.pieces.find((p) => p.id === id);

describe('placing (spec §5.4 Place, §5.3 Room full)', () => {
  it('Place puts an owned piece on the nearest free valid spot, selects it and counts it out of the inventory', () => {
    const s = run(start(), { type: 'place', item: 'plant.fern' });
    expect(s.selected).toBe('p1');
    expect(piece(s, 'p1')!.item).toBe('plant.fern');
    expect([inventory(s)['plant.fern'], s.past.length, isChanged(s)]).toEqual([1, 1, true]);
  });

  it('never places what you don\'t own or have none left of (ledger: the reducer checks counts)', () => {
    const s = start();
    expect(run(s, { type: 'place', item: 'plant.monstera' }).draft).toBe(s.draft);
    const none = run(s, { type: 'place', item: 'plant.cactus' }, { type: 'place', item: 'plant.cactus' });
    expect(none.draft.layout.pieces.filter((p) => p.item === 'plant.cactus')).toHaveLength(1);
    expect(none.outcome).toEqual({ ok: false, refused: { reason: 'outside' }, id: null, item: 'plant.cactus' });
  });

  it('at the cap, Place is refused with "full" and canPlace is false', () => {
    const many = { ...starterLayout(), pieces: [...starterLayout().pieces, ...Array.from({ length: 33 }, (_, k): Placement => ({ id: `w${k}`, item: 'art.calendar', layer: 'wallR', x: 0, y: 0, facing: 'L', mirror: false }))] };
    const s = start({ layout: many, counts: { ...COUNTS, 'art.calendar': 40 } });
    expect(canPlace(s, 'plant.fern')).toBe(false);
    expect(run(s, { type: 'place', item: 'plant.fern' }).outcome).toEqual({ ok: false, refused: { reason: 'full' }, id: null, item: 'plant.fern' });
  });
});

describe('dragging (spec §5.3)', () => {
  it('a valid drop moves the piece (children follow) as one undo step', () => {
    const s = run(start(), { type: 'drop', id: 'desk', item: 'desk.monitor', target: { layer: 'floor', x: 2, y: 4 } });
    expect([piece(s, 'desk')!.x, piece(s, 'desk')!.y, s.past.length]).toEqual([2, 4, 1]);
    expect(childrenOf(s.draft.layout, 'desk').map((p) => p.id)).toEqual(['lamp', 'deskitem']);
  });

  it('an invalid drop changes nothing: a moved piece stays where it was, a new one stays in the inventory', () => {
    const s = start();
    const moved = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 9, y: 9 } });
    expect([moved.draft, moved.past.length, moved.outcome]).toEqual([s.draft, 0, { ok: false, refused: { reason: 'outside' }, id: 'plant' }]);
    const fresh = run(s, { type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 3, y: 2 } });
    expect([fresh.draft, fresh.outcome]).toEqual([s.draft, { ok: false, refused: { reason: 'seat', with: 'desk' }, id: null, item: 'corner.beanbag' }]);
  });

  it('dropping a desk from the drawer replaces the desk, never adds a second one (ruling T9-FIX)', () => {
    const s = run(start({ counts: { ...COUNTS, 'desk.laptop': 1 } }), { type: 'drop', id: null, item: 'desk.laptop', target: { layer: 'floor', x: 4, y: 4 } });
    const desks = s.draft.layout.pieces.filter((p) => p.item.startsWith('desk.'));
    expect(desks.map((p) => [p.id, p.item, p.x, p.y])).toEqual([['desk', 'desk.laptop', 2, 0]]);
    expect(childrenOf(s.draft.layout, 'desk').length).toBeGreaterThan(0);
    expect([s.past.length, inventory(s)['desk.monitor'], inventory(s)['desk.laptop']]).toEqual([1, 1, 0]);
  });

  it('a refused drop from the drawer names the dragged piece, whatever is picked (ruling T12-CARRY)', () => {
    const s = run(start({ counts: { ...COUNTS, 'item.mug': 2 } }), { type: 'pick', item: 'plant.fern' }, { type: 'drop', id: null, item: 'item.mug', target: { layer: 'floor', x: 6, y: 6 } });
    expect(s.outcome).toEqual({ ok: false, refused: { reason: 'layer' }, id: null, item: 'item.mug' });
    expect(outcomeText(s)).toEqual({ kind: 'reason', text: 'Only on a desk or shelf' });
  });

  it('a let-go that never snapped records its reason and changes nothing (ruling T12-FIX)', () => {
    const s = start();
    const r = run(s, { type: 'refused', id: 'plank', item: 'shelf.plank', refused: { reason: 'layer' } });
    expect([r.draft, r.past.length, r.outcome]).toEqual([s.draft, 0, { ok: false, refused: { reason: 'layer' }, id: 'plank', item: 'shelf.plank' }]);
    expect(outcomeText(r)).toEqual({ kind: 'reason', text: 'Only on the wall' });
  });

  it('a drop from the drawer adds a new piece with a new id', () => {
    const s = run(start(), { type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 6, y: 6 } });
    expect([piece(s, 'p1')?.item, s.selected]).toEqual(['corner.beanbag', 'p1']);
  });
});

describe('the toolbar (spec §5.3)', () => {
  it('Flip mirrors; Turn switches facing and keeps the back corner, or refuses and stays', () => {
    let s = run(start(), { type: 'select', id: 'desk' }, { type: 'flip' });
    expect(piece(s, 'desk')!.mirror).toBe(true);
    s = run(s, { type: 'turn' });
    expect([piece(s, 'desk')!.facing, piece(s, 'desk')!.x, piece(s, 'desk')!.y]).toEqual(['R', 2, 0]);
    // A fern at (2, 2) is clear of the desk facing L, but inside its footprint turned to R.
    const edge = run(start(), { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 2, y: 2 } }, { type: 'select', id: 'desk' });
    const turned = run(edge, { type: 'turn' });
    expect([turned.draft, turned.outcome?.ok]).toEqual([edge.draft, false]);
    expect(selectedTools(edge)!.canTurn).toBe(false);
    expect(selectedTools(run(start(), { type: 'select', id: 'plant' }))!.canTurn).toBe(false); // facings: 1
  });

  it('Another places one more copy near the piece; greyed at ×0 and for the desk', () => {
    let s = run(start(), { type: 'select', id: 'plant' });
    expect(selectedTools(s)!.canAnother).toBe(true);
    s = run(s, { type: 'another' }, { type: 'select', id: 'plant' }, { type: 'another' });
    expect(s.draft.layout.pieces.filter((p) => p.item === 'plant.fern')).toHaveLength(3);
    expect(selectedTools(run(s, { type: 'select', id: 'plant' }))!.canAnother).toBe(false);
    const desk = selectedTools(run(start(), { type: 'select', id: 'desk' }))!;
    expect([desk.canAnother, desk.canStore, desk.isDesk]).toEqual([false, false, true]);
  });

  it('Store sends a piece and everything on it to the inventory; Undo puts both back on the same spot', () => {
    const s = run(start(), { type: 'select', id: 'plank' });
    expect(selectedTools(s)!.children).toBe(1);
    const stored = run(s, { type: 'store' });
    expect([piece(stored, 'plank'), piece(stored, 'shelf'), inventory(stored)['shelf.plank'], inventory(stored)['shelf.books'], stored.selected])
      .toEqual([undefined, undefined, 1, 1, null]);
    const back = run(stored, { type: 'undo' });
    expect(back.draft).toEqual(s.draft);
    expect(piece(back, 'shelf')).toEqual({ id: 'shelf', item: 'shelf.books', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'plank', spot: 0 });
  });

  it('Replace desk takes the old desk\'s corner, facing and children; refuses when it does not fit', () => {
    const s = run(start(), { type: 'replaceDesk', item: 'desk.notebook' });
    expect([piece(s, 'desk')!.item, piece(s, 'desk')!.x, childrenOf(s.draft.layout, 'desk').length, s.past.length]).toEqual(['desk.notebook', 2, 2, 1]);
    expect(inventory(s)['desk.monitor']).toBe(1);
    expect(run(start(), { type: 'replaceDesk', item: 'desk.laptop' }).draft).toEqual(start().draft); // not owned
  });

  it('Replace desk with a desk you have none left of, or the same desk, says why (ruling UI-OUTCOMES)', () => {
    const none = run(start(), { type: 'replaceDesk', item: 'desk.laptop' });
    expect(none.outcome).toEqual({ ok: false, refused: { reason: 'none' }, id: null, item: 'desk.laptop' });
    expect(outcomeText(none)).toEqual({ kind: 'reason', text: 'None left to place' });
    const same = run(start({ counts: { ...COUNTS, 'desk.monitor': 2 } }), { type: 'replaceDesk', item: 'desk.monitor' });
    expect([same.draft, same.past.length]).toEqual([start().draft, 0]);
    expect(outcomeText(same)).toEqual({ kind: 'reason', text: 'That desk is in the room already' });
  });
});

describe('undo and redo (spec §5.3: 20 steps)', () => {
  it('goes back and forward; a new change clears redo; at most 20 steps are kept', () => {
    let s = start();
    for (let k = 0; k < 25; k++) s = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: k % 2 ? 0 : 1, y: 6 } });
    expect(s.past).toHaveLength(UNDO_STEPS);
    s = run(s, { type: 'undo' }, { type: 'undo' });
    expect(s.future).toHaveLength(2);
    s = run(s, { type: 'redo' });
    expect([s.past.length, s.future.length]).toEqual([UNDO_STEPS - 1, 1]);
    s = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 6, y: 5 } });
    expect(s.future).toEqual([]);
  });
});

describe('styles, worn, sets and previews (spec §5.4)', () => {
  it('a style is one undo step and must be owned', () => {
    const s = run(start(), { type: 'style', key: 'wallpaper', item: 'wall.dots' }, { type: 'style', key: 'wallpaper', item: 'wall.brick' });
    expect([s.draft.layout.styles.wallpaper, s.past.length]).toEqual(['wall.dots', 1]);
  });

  it('a locked worn piece previews without entering the draft (Spec B ruling P18)', () => {
    const s = run(start(), { type: 'previewWorn', slot: 'head', item: 'out.crown' });
    expect([s.draft.worn.head, displayDraft(s).worn.head, isChanged(s)]).toEqual([null, 'out.crown', false]);
    expect(run(s, { type: 'wear', slot: 'head', item: 'out.beanie' }).draft.worn.head).toBe('out.beanie');
  });

  it('Apply set stores everything and places the set\'s layout with owned copies only, as one step', () => {
    const cottage = catalogueSet('cottage')!;
    const counts = { ...COUNTS, ...Object.fromEntries([...Object.values(cottage.room), ...Object.values(cottage.worn)].map((id) => [id!, 1])) };
    const s = run(start({ counts }), { type: 'applySet', setId: 'cottage' });
    expect([s.draft.layout, s.draft.worn.head, s.past.length]).toEqual([cottage.layout, 'out.beanie', 1]);
    expect(s.outcome).toEqual({ ok: true, id: null, applied: { setId: 'cottage', missing: [], deskKept: false } });
  });

  it('a partly owned set with its desk places the owned pieces, skips the rest and says what is missing (ruling T9-FIX)', () => {
    const counts = { ...COUNTS, 'set.cottage.desk': 1, 'set.cottage.rug': 1 };
    const s = run(start({ counts }), { type: 'applySet', setId: 'cottage' });
    const items = s.draft.layout.pieces.map((p) => p.item).sort();
    expect(items).toEqual(['plant.fern', 'set.cottage.desk', 'set.cottage.rug', 'shelf.plank']);
    expect(s.past).toHaveLength(1);
    const applied = s.outcome && s.outcome.ok && s.outcome.id === null ? s.outcome.applied : null;
    expect(applied?.deskKept).toBe(false);
    expect(applied?.missing).toEqual(expect.arrayContaining(['set.cottage.lamp', 'set.cottage.pet', 'set.cottage.wallpaper']));
    expect(applied?.missing).not.toContain('set.cottage.rug');
    expect(applied?.missing).not.toContain('out.beanie');
  });

  it('a partly owned set without its desk keeps your desk and still places the owned pieces (ruling T9-FIX)', () => {
    const counts: Record<string, number> = { ...COUNTS, 'set.cottage.rug': 1, 'set.cottage.pet': 1 };
    const s = run(start({ counts }), { type: 'applySet', setId: 'cottage' });
    const desks = s.draft.layout.pieces.filter((p) => p.item.startsWith('desk.') || p.item === 'set.cottage.desk');
    expect(desks.map((p) => p.item)).toEqual(['desk.monitor']);
    expect(s.draft.layout.pieces.map((p) => p.item)).toEqual(expect.arrayContaining(['set.cottage.rug', 'set.cottage.pet', 'plant.fern']));
    expect(s.draft.layout.pieces.every((p) => (counts[p.item] ?? 0) > 0)).toBe(true);
    expect(s.past).toHaveLength(1);
    const applied = s.outcome && s.outcome.ok && s.outcome.id === null ? s.outcome.applied : null;
    expect(applied?.deskKept).toBe(true);
    expect(applied?.missing).toContain('set.cottage.desk');
  });
});

describe('without dragging (spec §5.7)', () => {
  it('nudges along the tile axes and says where it went or why not', () => {
    let s = run(start(), { type: 'select', id: 'plant' }, { type: 'nudge', dir: 'frontRight' });
    expect([piece(s, 'plant')!.x, s.outcome]).toEqual([1, { ok: true, id: 'plant' }]);
    s = run(s, { type: 'nudge', dir: 'backLeft' }, { type: 'nudge', dir: 'backLeft' });
    expect([piece(s, 'plant')!.x, s.outcome]).toEqual([0, { ok: false, refused: { reason: 'outside' }, id: 'plant' }]);
  });

  it('moves wall pieces along and up or down, and Put on moves a piece onto a free spot', () => {
    let s = run(start(), { type: 'select', id: 'plank' }, { type: 'nudge', dir: 'up' }, { type: 'nudge', dir: 'frontRight' });
    expect([piece(s, 'plank')!.x, piece(s, 'plank')!.y]).toEqual([7, 11]);
    s = run(s, { type: 'select', id: 'plant' }, { type: 'putOn', parent: 'desk', spot: 1 });
    expect(piece(s, 'plant')).toMatchObject({ layer: 'onTop', parent: 'desk', spot: 1 });
  });
});

describe('Put on… and back to the floor (spec §5.7)', () => {
  it('lists the free surfaces once each, and the floor for a piece that can stand there', () => {
    const fern = run(start(), { type: 'select', id: 'plant' });
    expect(putOnOptions(fern).map((o) => o.noun)).toEqual(['desk', 'wall plank']);
    const mug = run(start(), { type: 'select', id: 'deskitem' });
    expect(putOnOptions(mug).map((o) => o.noun)).toEqual(['desk', 'wall plank']); // its own desk's other free spot too
    const onDesk = run(start(), { type: 'select', id: 'plant' }, { type: 'putOn', parent: 'desk', spot: 1 }, { type: 'select', id: 'plant' });
    expect(putOnOptions(onDesk).some((o) => o.parent === null)).toBe(true);
    const down = run(onDesk, { type: 'toFloor' });
    expect(piece(down, 'plant')!.layer).toBe('floor');
  });

  it('never offers the spot a piece already stands on, nor the floor to a piece that only stands on a surface', () => {
    const mug = run(start(), { type: 'select', id: 'deskitem' });
    const own = piece(mug, 'deskitem')!;
    expect(putOnOptions(mug).find((o) => o.parent === own.parent)!.spot).not.toBe(own.spot);
    expect(putOnOptions(mug).some((o) => o.parent === null)).toBe(false);
  });

  it('back to the floor lands on a free tile as one undo step; a piece that can\'t stand there is refused', () => {
    const onDesk = run(start(), { type: 'select', id: 'plant' }, { type: 'putOn', parent: 'desk', spot: 1 });
    const down = run(onDesk, { type: 'toFloor' });
    expect([down.outcome, down.past.length]).toEqual([{ ok: true, id: 'plant' }, 2]);
    const mug = run(start(), { type: 'select', id: 'deskitem' });
    const no = run(mug, { type: 'toFloor' });
    expect([no.draft, no.outcome]).toEqual([mug.draft, { ok: false, refused: { reason: 'layer' }, id: 'deskitem' }]);
  });

  it('says where a moved piece is, or why it could not move; a refused new piece is not a move', () => {
    const s = run(start(), { type: 'select', id: 'plant' }, { type: 'nudge', dir: 'frontLeft' });
    expect(nudgeAnnouncement(s)).toBe('Moved. Tile 1, 2');
    expect(nudgeAnnouncement(run(s, { type: 'nudge', dir: 'backLeft' }))).toBe("Can't move there: doesn't fit here");
    const plank = run(start(), { type: 'select', id: 'plank' }, { type: 'nudge', dir: 'up' });
    expect(nudgeAnnouncement(plank)).toBe('Moved. On the wall, 12 up');
    expect(movedText(start().draft.layout, piece(start(), 'lamp')!)).toBe('On the desk');
    expect(nudgeAnnouncement(run(start(), { type: 'place', item: 'plant.monstera' }))).toBeNull();
  });

  it('starting or ending Move forgets the last result, so it is never said as a move', () => {
    const s = run(start(), { type: 'select', id: 'plant' }, { type: 'flip' });
    expect(s.outcome).not.toBeNull();
    expect(run(s, { type: 'nudging', on: true }).outcome).toBeNull();
  });
});

describe('the guided first placement (spec §11.1)', () => {
  it('step 1 ends when the lantern is placed (it is selected), step 2 when it is turned', () => {
    let s = start({}, { coach: true, drawer: 'new', item: 'lamp.welcome' });
    expect([s.coach?.step, s.coach?.tile, s.drawer, s.picked]).toEqual([1, [5, 3], 'all', 'lamp.welcome']); // nothing new: All
    s = run(s, { type: 'drop', id: null, item: 'lamp.welcome', target: { layer: 'floor', x: 5, y: 3 } });
    expect([s.coach?.step, piece(s, s.selected!)!.item]).toEqual([2, 'lamp.welcome']);
    s = run(s, { type: 'turn' });
    expect(s.coach?.step).toBe(3);
    expect(run(s, { type: 'coach', step: null }).coach).toBeNull();
  });
});

describe('saving (Spec B §6.4 rulings)', () => {
  it('a refreshed read replaces the draft, clears history and keeps the notice; saved rebases', () => {
    const changed = run(start(), { type: 'place', item: 'plant.fern' });
    const other = { layout: { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.dots' } }, worn: EMPTY_WORN };
    const r = run(changed, { type: 'refreshed', draft: other, version: 4, counts: COUNTS, tier: 1 });
    expect([r.draft, r.saved, r.past, r.notice, r.baseVersion, isChanged(r)]).toEqual([other, other, [], 'refreshed', 4, false]);
    expect(run(changed, { type: 'saved', draft: changed.draft, version: 5 }).baseVersion).toBe(5);
  });

  it('a save starting clears the last failure, so the same failure is a new notice (ruling T12-CARRY)', () => {
    const failed = run(start(), { type: 'place', item: 'plant.fern' }, { type: 'saveFailed' });
    const again = run(failed, { type: 'saving' });
    expect([failed.notice, again.notice, again.draft]).toEqual(['saveFailed', null, failed.draft]);
  });
});
