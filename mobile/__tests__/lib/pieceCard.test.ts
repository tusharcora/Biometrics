import { GEOMETRY_DEPS } from '../../src/lib/room/catalogue';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { cardPieces, pieceCard, pieceTap } from '../../src/lib/room/card';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const DAY = { hhmm: '12:00', hour: 12 };

it('the radio\'s card: where it goes, the coin shop and its price, what it does and the sound switch (spec §8.1, F7)', () => {
  const l = room(at('p1', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }));
  expect(pieceCard(l, 1, NEUTRAL_LIVING, DAY, 'p1')).toEqual({
    id: 'p1', item: 'item.radio', name: 'Old radio', nameSpoken: 'Old radio',
    where: { text: 'Shelf, desk or floor · 1 tile', spoken: 'Shelf, desk or floor, 1 tile' },
    earned: { text: 'From the coin shop · 150 coins', spoken: 'From the coin shop, 150 coins' },
    effect: 'Plays a quiet lo-fi loop while the room is open. Notes float up from it.',
    state: null, resting: null, sound: true,
  });
});

it('a plant\'s card says how it grew, the cat\'s how it is, the shelf how many awards: never advice (spec §8.3)', () => {
  const living = { plantStage: 3 as const, petEnergy: 'play' as const, awards: [5, 4] };
  const l = room(at('p1', 'pet.tabby', { x: 6, y: 6 }), at('p2', 'shelf.awards', { layer: 'wallR', x: 0, y: 12 }));
  expect(pieceCard(l, 1, living, DAY, 'plant')).toMatchObject({ effect: 'KIP looks a little happier with a plant in the room.', state: 'The fern grew: 14 nights at your goal.' });
  expect(pieceCard(l, 1, { ...living, plantStage: 1 }, DAY, 'plant')!.state).toBe('The fern is just starting out.');
  // Stage 5 is every pre-P3 room (PF3-PLANTS-2) and the neutral fallback: no night count the server never measured.
  expect(pieceCard(l, 1, { ...living, plantStage: 5 }, DAY, 'plant')!.state).toBe('The fern is fully grown.');
  expect(pieceCard(l, 1, NEUTRAL_LIVING, DAY, 'plant')!.state).toBe('The fern is fully grown.');
  expect(pieceCard(l, 1, living, DAY, 'p1')!.state).toBe('The cat’s playing.');
  expect(pieceCard(l, 1, living, { hhmm: '23:00', hour: 23 }, 'p1')!.state).toBe('The cat’s napping.');
  expect(pieceCard(l, 1, living, DAY, 'p2')!.state).toBe('2 awards so far.');
  expect(pieceCard(l, 1, living, DAY, 'p2')!.earned).toEqual({ text: 'In every room from day one', spoken: 'In every room from day one' });
});

it('an inert piece says it rests, and a missing piece has no card (ruling 5)', () => {
  const clocks = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'art.clock', { layer: k < 2 ? 'wallR' : 'wallL', x: k % 2 ? 10 : 0 }));
  expect(pieceCard(room(...clocks), 1, NEUTRAL_LIVING, DAY, 'p4')!.resting).toBe('Resting. This room runs 3 effects at a time.');
  expect(pieceCard(room(...clocks), 1, NEUTRAL_LIVING, DAY, 'p1')!.resting).toBeNull();
  expect(pieceCard(starterLayout(), 1, NEUTRAL_LIVING, DAY, 'nope')).toBeNull();
});

it('a tap opens the card of an effect piece or a plant, squashes a running tap piece, and passes over the rest', () => {
  const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }));
  const e = roomEffects(l, 1, NEUTRAL_LIVING, null);
  expect([pieceTap(l, 'p1', e), pieceTap(l, 'plant', e), pieceTap(l, 'rug', e), pieceTap(l, 'desk', e)]).toEqual(['card', 'card', 'none', 'none']);
  const deps = { isoOf: (id: string) => (id === 'item.mug' ? { ...GEOMETRY_DEPS.isoOf(id)!, effect: 'tap' as const } : GEOMETRY_DEPS.isoOf(id)) };
  expect(pieceTap(starterLayout(), 'deskitem', roomEffects(starterLayout(), 1, NEUTRAL_LIVING, null, deps), deps)).toBe('squash');
});

it('a screen reader reaches each card through the room image\'s actions, read without "·"', () => {
  const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }));
  const actions = cardPieces(l, roomEffects(l, 1, NEUTRAL_LIVING, null));
  expect(actions).toEqual([{ id: 'plant', label: 'Fern card' }, { id: 'p1', label: 'Floor lamp card' }]);
  for (const a of actions) expect(a.label).not.toMatch(/·|×/);
});
