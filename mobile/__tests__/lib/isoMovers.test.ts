import { roomEffects } from '../../src/lib/room/effects';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { KIP_MOVER, kipTileCell, moverOrder, pieceTileCell, sameTile } from '../../src/lib/room/iso/movers';
import { drawIsoStatic, drawKipLayer, kipLayerKey } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';

const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
const input = (pieces: Placement[]) => ({ layout: { ...starterLayout(), pieces: [...starterLayout().pieces, ...pieces] }, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const });

it('keeps the static order: the shell, then each floor piece\'s run, is back + front (P1 Task 8 minor, ruling 25)', () => {
  const s = drawIsoStatic(input([at('p1', 'corner.beanbag', 3, 5), at('p2', 'plant.cactus', 6, 1)]));
  expect([...s.under, ...s.runs.flatMap((r) => r.rects)]).toEqual([...s.back, ...s.front]);
  // behind + KIP + ahead is the full order: the runs before KIP are `behind`'s floor pieces, the rest `ahead`'s.
  const order = moverOrder(s.runs, [{ key: KIP_MOVER, depth: s.seat! }], [s.deskId!, KIP_MOVER]);
  expect(order.filter((k) => k !== KIP_MOVER)).toEqual(s.runs.map((r) => r.id));
  const floorIds = (pps: typeof s.behind) => pps.filter((pp) => s.runs.some((r) => r.id === pp.p.id)).map((pp) => pp.p.id);
  expect([...floorIds(s.behind), KIP_MOVER, ...floorIds(s.ahead)]).toEqual(order);
});

it('puts a mover after what is behind its tile and before what is in front of it (spec §3.4)', () => {
  const s = drawIsoStatic(input([at('p1', 'corner.beanbag', 3, 5), at('p2', 'plant.cactus', 3, 2)]));
  const order = moverOrder(s.runs, [{ key: KIP_MOVER, depth: [3, 4] }], null);
  expect(order.indexOf('desk')).toBeLessThan(order.indexOf(KIP_MOVER));
  expect(order.indexOf('p2')).toBeLessThan(order.indexOf(KIP_MOVER));
  expect(order.indexOf(KIP_MOVER)).toBeLessThan(order.indexOf('p1')); // the bean bag in front hides KIP's feet
  // At the seat, inside the desk's footprint, KIP still comes after the desk (the static picture's own edge).
  const seated = moverOrder(s.runs, [{ key: KIP_MOVER, depth: s.seat! }], ['desk', KIP_MOVER]);
  expect(seated.indexOf('desk')).toBeLessThan(seated.indexOf(KIP_MOVER));
});

it('a run\'s key changes only when its own piece does (a minute, a stage), so the others keep their pictures', () => {
  const pieces = [{ ...at('p1', 'art.clock', 0, 0), layer: 'wallR' as const }];
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, ...pieces] };
  const base = { layout, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const };
  // Looked up by id (PF3-TESTS): the fern stands behind the desk, so it is the first run.
  const keys = (hhmm: string, stage: 1 | 5) => Object.fromEntries(
    drawIsoStatic({ ...base, effects: roomEffects(layout, 1, { plantStage: stage, petEnergy: 'wander', awards: [] }, { hhmm, hour: 7 }) }).runs.map((r) => [r.id, r.key]),
  );
  expect(keys('07:12', 5)).toEqual(keys('07:13', 5)); // the clock is on the wall, in `under`
  const [a, b] = [keys('07:12', 5), keys('07:12', 1)];
  expect([a.desk === b.desk, a.plant === b.plant]).toEqual([true, false]); // only the fern's run changes with its stage
});

it('leaves movers out of the picture, and places KIP and a piece on a tile as the seat and the anchor do', () => {
  const s = drawIsoStatic({ ...input([]), movers: ['plant'] });
  expect(s.runs.map((r) => r.id)).toEqual(['desk']);
  expect(s.hits.some((h) => h.id === 'plant')).toBe(false);
  const g = isoGrid(1);
  expect(kipTileCell(g, s.seat!)).toEqual([s.kipSeat.x, s.kipSeat.y]);
  expect(pieceTileCell(g, [2, 3])).toEqual([g.ox + (2 - 3) * 12, g.oy + (2 + 3) * 6]);
  expect([sameTile([1, 2], [1, 2]), sameTile([1, 2], null), sameTile([1, 2], [2, 1])]).toEqual([true, false, false]);
});

it('mirrors a walking KIP when it heads left, whatever its facing, and keys the flip (spec §3.6)', () => {
  const s = drawIsoStatic(input([]));
  const kip = { colour: 'coral' as const, pose: 'rest' as const, mood: 'glance' as const, worn: EMPTY_WORN, facing: 'you' as const };
  expect(drawKipLayer({ ...kip, flip: true }, s.kipSeat)).not.toEqual(drawKipLayer(kip, s.kipSeat));
  expect(drawKipLayer({ ...kip, flip: false }, s.kipSeat)).toEqual(drawKipLayer(kip, s.kipSeat));
  expect(new Set([kipLayerKey(kip), kipLayerKey({ ...kip, flip: true }), kipLayerKey({ ...kip, flip: false })]).size).toBe(3);
});
