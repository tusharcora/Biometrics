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
