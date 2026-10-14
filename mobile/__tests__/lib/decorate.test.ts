import { decorateReducer, displayLook, initDecorate, isChanged, type Look } from '../../src/lib/room/decorate';
import { catalogueSet } from '../../src/lib/room/catalogue';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';

const SAVED: Look = { room: STARTER_LOADOUT, worn: EMPTY_WORN };
const run = (...actions: Parameters<typeof decorateReducer>[1][]) => actions.reduce(decorateReducer, initDecorate(SAVED));

it('opens on the Room tab at the wallpaper, or on the tab and slot asked for', () => {
  expect([initDecorate(SAVED).tab, initDecorate(SAVED).roomSlot]).toEqual(['room', 'wallpaper']);
  expect([initDecorate(SAVED, { slot: 'rug' }).tab, initDecorate(SAVED, { slot: 'rug' }).roomSlot]).toEqual(['room', 'rug']);
  expect([initDecorate(SAVED, { slot: 'head' }).tab, initDecorate(SAVED, { slot: 'head' }).wornSlot]).toEqual(['kip', 'head']);
  expect(initDecorate(SAVED, { tab: 'sets' }).tab).toBe('sets');
});

it('placing an owned item changes the draft; placing it again does nothing', () => {
  const s = run({ type: 'place', slot: 'wallpaper', itemId: 'wall.dots' });
  expect([s.draft.room.wallpaper, isChanged(s), s.history.length]).toEqual(['wall.dots', true, 1]);
  const again = decorateReducer(s, { type: 'place', slot: 'wallpaper', itemId: 'wall.dots' });
  expect(again.history.length).toBe(1);
});

it('a locked item is a preview only: shown, never in the draft', () => {
  const s = run({ type: 'preview', slot: 'rug', itemId: 'rug.red' });
  expect([displayLook(s).room.rug, s.draft.room.rug, isChanged(s)]).toEqual(['rug.red', 'rug.slate', false]);
  const next = decorateReducer(s, { type: 'place', slot: 'wallpaper', itemId: 'wall.dots' });
  expect([displayLook(next).room.rug, next.preview]).toEqual(['rug.slate', null]);
});

it('Apply set fills every room slot and the set\'s worn pieces in one Undo step', () => {
  const cottage = catalogueSet('cottage')!;
  const s = run({ type: 'place', slot: 'rug', itemId: 'rug.red' }, { type: 'applySet', setId: 'cottage' });
  expect([s.draft.room, s.draft.worn.head, s.history.length]).toEqual([cottage.room, 'out.beanie', 2]);
  const undone = decorateReducer(s, { type: 'undo' });
  expect([undone.draft.room.rug, undone.draft.room.wallpaper]).toEqual(['rug.red', 'wall.plain']);
});

it('a locked set is a preview that cannot be saved', () => {
  const s = run({ type: 'previewSet', setId: 'cottage' });
  expect([displayLook(s).room.wallpaper, isChanged(s)]).toEqual(['set.cottage.wallpaper', false]);
});

it('Undo steps back one change at a time, and does nothing with no history', () => {
  const s = run({ type: 'place', slot: 'rug', itemId: 'rug.red' }, { type: 'place', slot: 'pet', itemId: 'pet.bed' }, { type: 'undo' });
  expect([s.draft.room.rug, s.draft.room.pet]).toEqual(['rug.red', null]);
  expect(run({ type: 'undo' }).draft).toEqual(SAVED);
});

it('a tapped tile makes its slot the one the info line talks about', () => {
  expect(run({ type: 'place', slot: 'neck', itemId: null }).wornSlot).toBe('neck');
  expect(run({ type: 'preview', slot: 'pet', itemId: 'pet.bed' }).roomSlot).toBe('pet');
});

it('a refresh replaces saved and draft with the server\'s room and says so; a save clears the notice', () => {
  const server: Look = { room: { ...STARTER_LOADOUT, wallpaper: 'wall.dots' }, worn: EMPTY_WORN };
  const s = run({ type: 'place', slot: 'rug', itemId: 'rug.red' }, { type: 'refreshed', look: server, version: 5 });
  expect([s.draft, s.saved, s.history, s.notice, isChanged(s)]).toEqual([server, server, [], 'refreshed', false]);
  expect(decorateReducer(s, { type: 'saveFailed' }).notice).toBe('saveFailed');
});

it('keeps the version the draft was based on: set on open, by a refresh and by a save, never by anything else', () => {
  const opened = initDecorate(SAVED, {}, 3);
  expect(opened.baseVersion).toBe(3);
  const placed = decorateReducer(opened, { type: 'place', slot: 'rug', itemId: 'rug.red' });
  expect(decorateReducer(placed, { type: 'saveFailed' }).baseVersion).toBe(3);
  expect(decorateReducer(placed, { type: 'refreshed', look: SAVED, version: 5 }).baseVersion).toBe(5);
  expect(decorateReducer(placed, { type: 'saved', look: SAVED, version: 4 }).baseVersion).toBe(4);
});
