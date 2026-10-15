import { performance } from 'perf_hooks';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { clearPieceCache } from '../../src/lib/room/iso/art';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { drawIsoFramesEach, drawIsoStatic, drawKipLayer } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';

// Spec 2026-10-15 §3.7 budget, for a full 9 × 9 room of 90 pieces at night: every piece picture cold, the rebuild
// after a drop, and one frame's compose. On-device targets are checked by hand (Task 16); this measures the pure build
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
    console.info(JSON.stringify({ event: 'room.iso.build', pieces: layout.pieces.length, coldMs: cold, rebuildMs: rebuild, frameMs: frame }));
    expect(layout.pieces).toHaveLength(90);
    for (const ms of [cold, rebuild, frame]) expect(Number.isFinite(ms) && ms > 0).toBe(true);
  });
});
