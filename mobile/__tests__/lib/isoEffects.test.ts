import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { effectsKey, roomEffects } from '../../src/lib/room/effects';
import type { RoomRect } from '../../src/lib/room/grid';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import { POT_COLOURS, squashRects } from '../../src/lib/room/iso/pieces/effectArt';
import { opaqueBounds } from '../../src/lib/room/iso/prims';
import { drawIsoStatic, isoRoomKey } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());
const cells = (rs: readonly RoomRect[]) => rs.filter(([, , , , c]) => !c.startsWith('rgba')).reduce((n, [, , w, h]) => n + w * h, 0);
const pots = (rs: readonly RoomRect[]) => rs.filter(([, , , , c]) => POT_COLOURS.has(c.toUpperCase()));
const FLOOR = { layer: 'floor' as const, facing: 'L' as const, mirror: false };
const PLANTS = CATALOGUE.items.filter((i) => i.slot === 'plant' && i.iso && isoArtOf(i.id)).map((i) => i.id);

it('a plant grows from the pot up: the pot stays, the leaves are cut from the top and narrowed (ruling 8)', () => {
  expect(PLANTS.length).toBe(7);
  for (const id of PLANTS) {
    const full = pieceLayers(id, CTX_DAY, FLOOR)!.base!;
    const young = pieceLayers(id, CTX_DAY, { ...FLOOR, effect: 'g1' })!.base!;
    expect({ id, pots: pots(young) }).toEqual({ id, pots: pots(full) });
    expect({ id, fewer: cells(young) < cells(full), shorter: opaqueBounds(young)!.h < opaqueBounds(full)!.h }).toEqual({ id, fewer: true, shorter: true });
  }
});

it('the floor lamp lays a warm pool on the floor after dark, only while it runs (spec §8.2, ruling 5)', () => {
  const lit = pieceLayers('corner.floorlamp', CTX_NIGHT, { ...FLOOR, effect: 'lit' })!.emissive!;
  const plain = pieceLayers('corner.floorlamp', CTX_NIGHT, FLOOR)!.emissive!;
  expect(lit.length).toBeGreaterThan(plain.length);
  expect(pieceLayers('corner.floorlamp', CTX_DAY, { ...FLOOR, effect: 'lit' })!.emissive).toEqual(pieceLayers('corner.floorlamp', CTX_DAY, FLOOR)!.emissive);
});

it('a squash keeps the piece\'s bottom row and shortens it (ruling 17)', () => {
  const base = pieceLayers('plant.fern', CTX_DAY, FLOOR)!.base!;
  const b = opaqueBounds(base)!;
  const s = opaqueBounds(squashRects(base, 0.7))!;
  expect([s.y + s.h, s.h < b.h]).toEqual([b.y + b.h, true]);
});

it('the static room follows the living room: a new stage is a new key and a new picture, the same one is not', () => {
  const layout = starterLayout();
  const input = (stage: 1 | 5) => ({ layout, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const, effects: roomEffects(layout, 1, { plantStage: stage, petEnergy: 'wander', awards: [] }, null) });
  expect(isoRoomKey(input(1))).not.toBe(isoRoomKey(input(5)));
  expect(isoRoomKey(input(5))).toBe(isoRoomKey(input(5)));
  expect(effectsKey(input(5).effects)).toBe('|'); // the neutral starter room has no state at all
  const total = (stage: 1 | 5) => { const s = drawIsoStatic(input(stage)); return cells(s.back) + cells(s.front); };
  expect(total(1)).toBeLessThan(total(5)); // the starter fern is smaller at stage 1
});

it('an inert floor lamp at night draws exactly as plain decor; only the running ones add a pool (ruling 5)', () => {
  // Three lamps take the 7 x 7 room's three slots; the fourth (the highest instance rank) rests.
  const base = starterLayout();
  const lamps = ['p1', 'p2', 'p3', 'p4'].map((id, k) => ({ id, item: 'corner.floorlamp', ...FLOOR, x: 6, y: 3 + k }));
  const layout = { ...base, pieces: [...base.pieces, ...lamps] };
  const night = { layout, tier: 1 as const, weather: 'fallback' as const, night: true, colour: 'coral' as const };
  const effects = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, null);
  expect([...effects.inert]).toEqual(['p4']);
  const lit = drawIsoStatic({ ...night, effects });
  const plain = drawIsoStatic(night);
  const hit = (s: ReturnType<typeof drawIsoStatic>, id: string) => s.hits.find((h) => h.id === id);
  expect(hit(lit, 'p4')).toEqual(hit(plain, 'p4'));
  expect([lit.back, lit.front]).toEqual([plain.back, plain.front]); // the pool is light, never a piece's cells
  const glows = (o: object) => pieceLayers('corner.floorlamp', CTX_NIGHT, { ...FLOOR, ...o })!.emissive!.length;
  expect(lit.emissive.length - plain.emissive.length).toBe(3 * (glows({ effect: 'lit' }) - glows({})));
});

it('a shipped plant’s pot is centred on x = 0 in its own space, the line growRects narrows about', () => {
  for (const id of PLANTS) {
    const b = opaqueBounds(pots(pieceLayers(id, CTX_DAY, FLOOR)!.base!))!;
    expect({ id, centred: Math.abs(b.x + b.w / 2) <= 1 }).toEqual({ id, centred: true });
  }
});
