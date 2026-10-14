import { performance } from 'perf_hooks';
import { drawRoomStatic } from '../../src/lib/room/draw';
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { STARTER_LOADOUT } from '../../src/lib/room/loadout';

// Spec §8 rendering budget: the static room builds in under 8 ms on an iPhone 12 / Pixel 6 class device. This measures
// the pure build in Node for every set at night (the heaviest case) and logs it; run with ROOM_PERF=1. Never logs user data.
// A measurement, not a gate (ruling 32): it only checks that the median it logs is a real time. Node's own clock: the
// React Native preset swaps the global performance.now for Date.now (whole milliseconds).
const run = process.env.ROOM_PERF === '1' ? describe : describe.skip;

run('room build time', () => {
  it.each([['starter', STARTER_LOADOUT] as const, ...CATALOGUE.sets.map((s) => [s.id, s.room] as const)])('%s at night', (name, loadout) => {
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t = performance.now();
      drawRoomStatic({ loadout, weather: 'stormy', night: true, colour: 'coral' });
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const medianMs = Number(times[20]!.toFixed(2));
    console.info(JSON.stringify({ event: 'room.build', set: name, medianMs }));
    expect(times.length).toBe(40);
    expect(Number.isFinite(medianMs) && medianMs > 0).toBe(true);
  });
});
