import { act, renderHook } from '@testing-library/react-native';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import { starterLayout } from '../../src/lib/room/layout';
import { STEP_MS, TRIP_MIN_MS, TRIP_SPAN_MS, USE_MS } from '../../src/lib/room/live/walk';
import { useKipWalk, walkMover, type KipWalk } from '../../src/lib/room/live/useKipWalk';

const layout = starterLayout();
const effects = roomEffects(layout, 1, NEUTRAL_LIVING, null);
const WHOLE = { x: -1000, y: -1000, w: 3000, h: 3000 };
const props = (enabled: boolean) => ({ enabled, layout, tier: 1 as const, effects, view: WHOLE, rng: () => 0 });
type Out = Exclude<KipWalk, { phase: 'seat' }>;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('rests 20 s, walks out half a tile a frame to the fern, uses it, walks back and sits (spec §9.2)', () => {
  const { result } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  expect(result.current).toEqual({ phase: 'seat' });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS); });
  expect(result.current.phase).toBe('walk');
  const seen: KipWalk[] = [result.current];
  for (let i = 0; i < 40 && result.current.phase !== 'use'; i++) { act(() => { jest.advanceTimersByTime(STEP_MS); }); seen.push(result.current); }
  expect(result.current).toMatchObject({ phase: 'use', kind: 'plant', target: 'plant' });
  expect(walkMover(result.current)).toMatchObject({ pose: 'water', moving: false });
  // Each loop frame moves KIP half a tile along one axis (ruling 13).
  const steps = (seen as Out[]).map((w) => w.pos);
  for (let k = 1; k < steps.length; k++) expect(Math.abs(steps[k]![0] - steps[k - 1]![0]) + Math.abs(steps[k]![1] - steps[k - 1]![1])).toBe(0.5);
  // It holds the use pose for 2.4 s, then walks back.
  act(() => { jest.advanceTimersByTime(USE_MS - 1); });
  expect(result.current.phase).toBe('use');
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current.phase).toBe('walk');
  for (let i = 0; i < 40 && result.current.phase !== 'seat'; i++) act(() => { jest.advanceTimersByTime(STEP_MS); });
  expect(result.current).toEqual({ phase: 'seat' });
});

it('stops at once: disabled mid-walk it is on the seat in the same render, and no timer fires (Review Focus 2)', () => {
  const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + STEP_MS * 3); });
  expect(result.current.phase).toBe('walk');
  rerender(props(false));
  expect(result.current).toEqual({ phase: 'seat' });
  expect(jest.getTimerCount()).toBe(0);
  rerender(props(true));
  expect(result.current).toEqual({ phase: 'seat' }); // starts over from the desk
});

it('a new room mid-walk puts KIP on its seat in that same render, and the trip starts over', () => {
  const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + STEP_MS * 3); });
  expect(result.current.phase).toBe('walk');
  const moved = { ...layout, pieces: layout.pieces.map((p) => (p.id === 'plant' ? { ...p, x: 1, y: 5 } : p)) };
  rerender({ ...props(true), layout: moved });
  expect(result.current).toEqual({ phase: 'seat' });
  expect(jest.getTimerCount()).toBe(1); // the rest before the next trip
});

it('waits 20 to 40 s between trips; with one target it goes back to it (ruling T10-ONE)', () => {
  const p = { ...props(true), rng: () => 0.5 };
  const { result } = renderHook((q: typeof p) => useKipWalk(q), { initialProps: p });
  const WAIT = TRIP_MIN_MS + 0.5 * TRIP_SPAN_MS;
  act(() => { jest.advanceTimersByTime(WAIT - 1); });
  expect(result.current.phase).toBe('seat');
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current).toMatchObject({ phase: 'walk', target: 'plant' });
  for (let i = 0; i < 80 && result.current.phase !== 'seat'; i++) act(() => { jest.advanceTimersByTime(STEP_MS); });
  expect(result.current.phase).toBe('seat');
  // The fern is the starter room's only target: after the next rest KIP goes to it again.
  act(() => { jest.advanceTimersByTime(WAIT - 1); });
  expect(result.current.phase).toBe('seat');
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current).toMatchObject({ phase: 'walk', target: 'plant' });
});

it('unmounted mid-trip, it leaves no timer behind', () => {
  const { result, unmount } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + STEP_MS * 3); });
  expect(result.current.phase).toBe('walk');
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('a cat that starts wandering or falls asleep while KIP goes to it puts KIP on its seat in that same render', () => {
  const cat = { ...layout, pieces: [...layout.pieces, { id: 'p9', item: 'pet.tabby', layer: 'floor' as const, x: 5, y: 2, facing: 'L' as const, mirror: false }] };
  const at = (petEnergy: 'play' | 'wander', hour = 12) => roomEffects(cat, 1, { ...NEUTRAL_LIVING, petEnergy }, { hhmm: `${hour}:00`, hour });
  for (const next of [at('wander'), at('play', 23)]) {
    const start = { ...props(true), layout: cat, effects: at('play') };
    // Every render's answer, so the check is on the render the change lands in, not after its effects.
    const renders: KipWalk[] = [];
    const { result, rerender, unmount } = renderHook((q: typeof start) => { const w = useKipWalk(q); renders.push(w); return w; }, { initialProps: start });
    act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + STEP_MS * 3); });
    expect(result.current).toMatchObject({ phase: 'walk', kind: 'cat', target: 'p9' });
    // The minute's new effects: the same layout, the cat in another state.
    const from = renders.length;
    rerender({ ...start, effects: next });
    expect(renders[from]).toEqual({ phase: 'seat' });
    expect(result.current).toEqual({ phase: 'seat' });
    expect(jest.getTimerCount()).toBe(1); // only the rest before the next trip
    unmount();
  }
});

it('a walking KIP bobs and glances the way it goes; seated there is no mover', () => {
  expect(walkMover({ phase: 'seat' })).toBeNull();
  expect(walkMover({ phase: 'walk', pos: [3, 1.5], depth: [3, 2], flip: true, kind: 'plant', target: 'plant' })).toEqual({ pos: [3, 1.5], depth: [3, 2], flip: true, pose: 'rest', moving: true, sway: false });
  expect(walkMover({ phase: 'use', pos: [3, 2], depth: [3, 2], flip: false, kind: 'sound', target: 'p1' })).toMatchObject({ pose: 'rest', sway: true });
});
