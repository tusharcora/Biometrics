import { drawerTabs, notPlaced, pieceTiles, setCards, styleRows, wornTiles } from '../../src/lib/room/edit/drawer';
import { initEditor, editorReducer } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const FACTS = { levels: {}, recapsRead: 1, buddyCheers: 0 };
const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'corner.beanbag': 1, 'shelf.luckycat': 1, 'wall.brick': 1 };
const start = (newIds: string[] = []) => initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts, version: 1, newIds });

it('the tabs: New only while something was unseen when the editor opened (ruling 15)', () => {
  expect(drawerTabs(start())).toEqual(['all', 'floor', 'wall', 'onTop', 'funny', 'effects', 'room', 'kip', 'sets']);
  expect(drawerTabs(start(['corner.beanbag']))).toContain('new');
});

it('lists owned placeable pieces with their inventory count; ×0 stays, dimmed, "All placed"', () => {
  const tiles = pieceTiles(start(), 'all');
  const fern = tiles.find((t) => t.item === 'plant.fern')!;
  const desk = tiles.find((t) => t.item === 'desk.monitor')!;
  expect([fern.count, fern.allPlaced, fern.label]).toEqual([2, false, 'Fern, 2 in inventory']);
  expect([desk.count, desk.allPlaced, desk.label]).toEqual([0, true, 'Monitor, all placed']);
  expect(tiles.some((t) => t.item === 'plant.monstera')).toBe(false); // locked: not in the drawer
  expect(tiles.some((t) => t.item === 'wall.plain')).toBe(false); // styles live on the Room tab
});

it('filters by layer and by the funny tag, and marks the new ones', () => {
  const s = start(['corner.beanbag']);
  expect(pieceTiles(s, 'wall').map((t) => t.item)).toEqual(expect.arrayContaining(['art.calendar', 'shelf.plank']));
  expect(pieceTiles(s, 'wall').some((t) => t.item === 'plant.fern')).toBe(false);
  expect(pieceTiles(s, 'onTop').some((t) => t.item === 'item.mug')).toBe(true);
  expect(pieceTiles(s, 'funny').map((t) => t.item).sort()).toEqual(['corner.beanbag', 'shelf.luckycat']);
  expect(pieceTiles(s, 'new').map((t) => [t.item, t.isNew])).toEqual([['corner.beanbag', true]]);
});

it('counts what is not placed for the header', () => {
  const s = start();
  const before = notPlaced(s);
  expect(notPlaced(editorReducer(s, { type: 'place', item: 'plant.fern' }))).toBe(before - 1);
});

it('the Room tab: one row per style, the current one selected, owned ones only', () => {
  const rows = styleRows(start());
  expect(rows.map((r) => r.key)).toEqual(['wallpaper', 'floor', 'window']);
  const walls = rows[0]!.tiles;
  expect(walls.find((t) => t.item === 'wall.plain')!.selected).toBe(true);
  expect(walls.map((t) => t.item)).toEqual(expect.arrayContaining(['wall.plain', 'wall.dots', 'wall.brick']));
  expect(walls.some((t) => t.item === 'wall.panel')).toBe(false);
});

it('the KIP tab keeps Spec B\'s worn tiles: None, owned, and locked ones with their unlock line', () => {
  const head = wornTiles(start(), 'head', FACTS);
  expect(head[0]).toMatchObject({ item: null, name: 'None' });
  expect(head.find((t) => t.item === 'out.beanie')!.locked).toBe(false);
  const cap = head.find((t) => t.item === 'out.cap')!;
  expect([cap.locked, cap.tag]).toEqual([true, 'Step goal · I']);
});

it('set cards: Cottage, locked here, with its pieces and unlock line', () => {
  const [cottage] = setCards(start(), FACTS);
  expect([cottage!.id, cottage!.owned, cottage!.line]).toEqual(['cottage', false, '13 pieces · Read 4 weekly recaps']);
});

it('the Effects tab lists the effect pieces you own, each tagged and read as doing something (spec §5.4, ruling 21)', () => {
  const s = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: { ...counts, 'art.clock': 1, 'item.radio': 1 }, version: 1, newIds: [] });
  const tiles = pieceTiles(s, 'effects');
  expect(tiles.map((t) => t.item).sort()).toEqual(['art.clock', 'item.radio', 'shelf.awards']);
  const radio = tiles.find((t) => t.item === 'item.radio')!;
  expect([radio.tag, radio.label]).toEqual(['Does something', 'Old radio, 1 in inventory, does something in the room']);
  expect(radio.label).toBe(ROOM_COPY.drawer.tile.effect(ROOM_COPY.drawer.tile.piece('Old radio', 1, false))); // the joiner is copy (T9-FIX M4)
  expect(pieceTiles(s, 'all').find((t) => t.item === 'plant.fern')!.tag).toBeNull();
});
