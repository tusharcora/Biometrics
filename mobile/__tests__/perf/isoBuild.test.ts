import { performance } from 'perf_hooks';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { clearPieceCache } from '../../src/lib/room/iso/art';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { drawIsoFramesEach, drawIsoStatic, drawKipLayer } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { KIP_MOVER, MOVER_PREFIX, kipTileCell, moverOrder, pieceTileCell } from '../../src/lib/room/iso/movers';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import { headsLeft, planTrip, posAt } from '../../src/lib/room/live/walk';

// Spec 2026-10-15 §3.7 budget, for a full 9 × 9 room of 90 pieces at night: every piece picture cold, the rebuild
// after a drop, and one frame's compose; and with movers (P3 ruling 11): the cold build with a cat left out, and a
// walk frame's own work (the depth order with KIP and the cat at their tiles, and where they stand). On-device targets are checked by hand (Task 16); this measures the pure build
// in Node and logs it (run with ROOM_PERF=1). A measurement, not a gate (Spec B ruling P32). Never logs user data.
const run = process.env.ROOM_PERF === '1' ? describe : describe.skip;

function fullRoom(): RoomLayout {
  const FLOOR = ['plant.fern', 'plant.cactus', 'corner.floorlamp', 'corner.beanbag', 'pet.bed', 'plant.monstera'];
  const pieces: Placement[] = starterLayout().pieces.filter((p) => p.id === 'desk' || p.parent === 'desk');
  let k = 0;
  for (let x = 0; x < 9 && pieces.length < 78; x++) for (let y = 0; y < 9 && pieces.length < 78; y++) {
    if ((x >= 2 && x < 5 && y < 2) || (x === 3 && y === 2)) continue;
    pieces.push({ id: `f${k}`, item: FLOOR[k++ % FLOOR.length]!, layer: 'floor', x, y, facing: 'L', mirror: false });
  }
  for (let a = 0; pieces.length < 90; a++) pieces.push({ id: `w${a}`, item: 'art.heart', layer: a % 2 ? 'wallL' : 'wallR', x: 3 * Math.floor(a / 2), y: 0, facing: 'L', mirror: false });
  return { ...starterLayout(), pieces };
}

const median = (f: () => void, n = 30) => {
  const t: number[] = [];
  for (let i = 0; i < n; i++) { const a = performance.now(); f(); t.push(performance.now() - a); }
  t.sort((a, b) => a - b);
  return Number(t[Math.floor(n / 2)]!.toFixed(2));
};

run('iso room build time', () => {
  it('cold, after a drop, and one frame at night', () => {
    const layout = fullRoom();
    const input = { layout, tier: 3 as const, weather: 'stormy' as const, night: true, colour: 'coral' as const };
    const cold = median(() => { clearPieceCache(); drawIsoStatic(input); });
    const rebuild = median(() => drawIsoStatic({ ...input, hide: null }));
    const s = drawIsoStatic(input);
    const kip = drawKipLayer({ colour: 'coral', pose: 'type', mood: 'idle', worn: EMPTY_WORN }, s.kipSeat);
    const frame = median(() => drawIsoFramesEach(s, { night: true, colour: 'coral', screen: 'dots' }, [kip, kip, kip]));
    const coldMovers = median(() => { clearPieceCache(); drawIsoStatic({ ...input, movers: ['f0'] }); });
    const m = drawIsoStatic({ ...input, movers: ['f0'] });
    const order = median(() => moverOrder(m.runs, [{ key: KIP_MOVER, depth: [4, 4] }, { key: `${MOVER_PREFIX}f0`, depth: [6, 6] }], null));
    const moverFrame = median(() => {
      moverOrder(m.runs, [{ key: KIP_MOVER, depth: [4, 5] }, { key: `${MOVER_PREFIX}f0`, depth: [6, 7] }], null);
      kipTileCell(m.grid, [4.5, 5]);
      pieceTileCell(m.grid, [6, 7]);
    });
    // KIP's walk (ruling 13): planning a trip (once per 20-40 s; this packed room is the worst case, every target
    // searched and none reachable), and a walk step's own work besides the order.
    const fx = roomEffects(layout, 3, NEUTRAL_LIVING, null);
    const whole = { x: -1000, y: -1000, w: 3000, h: 3000 };
    const trip = median(() => planTrip(layout, 3, fx, whole, null, () => 0.5));
    const path: [number, number][] = [[3, 1], [3, 2], [4, 2], [4, 3]];
    const walkStep = median(() => { const a = posAt(path, 3, 1); headsLeft(a.pos, posAt(path, 4, 1).pos); kipTileCell(m.grid, a.pos); });
    console.info(JSON.stringify({
      event: 'room.iso.build', pieces: layout.pieces.length, runs: m.runs.length, coldMs: cold, rebuildMs: rebuild, frameMs: frame,
      coldMoversMs: coldMovers, orderMs: order, moverFrameMs: moverFrame, tripMs: trip, walkStepMs: walkStep,
    }));
    expect(layout.pieces).toHaveLength(90);
    expect(m.runs.length).toBeGreaterThan(70);
    for (const ms of [cold, rebuild, frame, coldMovers, order, moverFrame, trip]) expect(Number.isFinite(ms) && ms > 0).toBe(true);
    expect(Number.isFinite(walkStep)).toBe(true);
  });
});
