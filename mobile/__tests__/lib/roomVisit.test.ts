// The visit's pure parts (spec 2026-10-15 §10.1; P4 rulings 24, 27).
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { starterLayout } from '../../src/lib/room/layout';
import { MAX_MISSING, missingPieces, panTo, pieceInfo, readVisit, tierOfSize, visitLight } from '../../src/lib/room/visit';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const dto = (over = {}) => ({ name: 'Maya', layout: starterLayout(), size: { n: 8, m: 8 }, kipColour: 'lime', kipWorn: { head: 'out.beanie', face: null, neck: null, ears: null }, cheersThisWeek: 3, cheeredToday: false, ...over });

it('reads the body: a size, never a tier name; a broken layout reads as the starter room', () => {
  const v = readVisit(dto());
  expect([v.tier, v.size, v.colour, v.worn.head]).toEqual([2, { n: 8, m: 8 }, 'lime', 'out.beanie']);
  expect(readVisit(dto({ layout: { nope: 1 } })).layout).toEqual(starterLayout());
  expect([tierOfSize({ n: 7, m: 7 }), tierOfSize({ n: 9, m: 9 }), tierOfSize({ n: 3, m: 3 })]).toEqual([1, 3, 1]);
  expect(ROOM_COPY.visit.size(v.size, 44)).toBe('8 × 8 · 44 pieces');
  expect(ROOM_COPY.visit.sizeSpoken(v.size, 44)).toBe('8 by 8, 44 pieces');
});

it('lists the pieces you don\'t have, each once, at most 12, with a price or the generic rule (ruling 27)', () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces,
    { id: 'p1', item: 'plant.monstera', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p2', item: 'plant.monstera', layer: 'floor' as const, x: 5, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p3', item: 'corner.gnome', layer: 'floor' as const, x: 4, y: 6, facing: 'L' as const, mirror: false }] };
  expect(missingPieces(layout, STARTER_COUNTS)).toEqual(['plant.monstera', 'corner.gnome']);
  expect(missingPieces(layout, { ...STARTER_COUNTS, 'corner.gnome': 1 })).toEqual(['plant.monstera']);
  expect(MAX_MISSING).toBe(12);
  expect(pieceInfo('corner.gnome')).toEqual({ name: 'Gnome', line: '80 coins in the coin shop', spoken: '80 coins in the coin shop' });
  expect(pieceInfo('plant.monstera').line).toBe('Sleep goal · I');
  expect(pieceInfo('plant.monstera').spoken).not.toMatch(/·|\bI\b/);
  expect(pieceInfo('corner.acorn').line).toBe('A weekly challenge trophy');
  expect(JSON.stringify(pieceInfo('plant.monstera'))).not.toMatch(/earned/);
});

it('caps the list at 12, in catalogue order, from a room full of pieces you have none of (ruling 27)', () => {
  const many = CATALOGUE.items.filter((i) => i.iso).map((i) => i.id);
  expect(many.length).toBeGreaterThan(12);
  // Placed backwards, each twice: the list still follows the catalogue, each piece once.
  const pieces = [...many, ...many].reverse().map((item, k) => ({ id: `q${k}`, item, layer: 'floor' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }));
  expect(missingPieces({ ...starterLayout(), pieces }, {})).toEqual(many.slice(0, 12));
});

it('draws by the visitor\'s clock with the fallback sky; pans inside the room', () => {
  expect(visitLight(new Date(2026, 9, 26, 21, 0))).toEqual({ weather: 'fallback', night: true });
  expect(visitLight(new Date(2026, 9, 26, 10, 0))).toEqual({ weather: 'fallback', night: false });
  expect(panTo({ x: -40, y: 0 }, -500, 20, { width: 300, height: 260 }, { width: 392, height: 344 })).toEqual({ x: -92, y: 0 });
});

it('a theme piece is priced for its theme weeks only, read aloud the same way (T9-FIX)', () => {
  const theme = CATALOGUE.items.filter((i) => i.shop === 'theme').map((i) => i.id);
  expect(theme).toEqual(['lamp.harvest', 'plant.ivy', 'lamp.moon', 'item.organiser']);
  for (const id of theme) {
    expect(pieceInfo(id)).toEqual({ name: expect.any(String), line: '80 coins in the coin shop in theme weeks', spoken: '80 coins in the coin shop in theme weeks' });
  }
  // An always-on shop piece keeps the plain price.
  expect(pieceInfo('corner.gnome').line).toBe('80 coins in the coin shop');
});

