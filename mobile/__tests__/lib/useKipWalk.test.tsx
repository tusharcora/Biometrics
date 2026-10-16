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

it('waits 20 to 40 s between trips, and never goes to the same piece twice in a row', () => {
  let r = 0.5;
  const p = { ...props(true), rng: () => r };
  const { result } = renderHook((q: typeof p) => useKipWalk(q), { initialProps: p });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + 0.5 * TRIP_SPAN_MS - 1); });
  expect(result.current.phase).toBe('seat');
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current.phase).toBe('walk');
  for (let i = 0; i < 80 && result.current.phase !== 'seat'; i++) act(() => { jest.advanceTimersByTime(STEP_MS); });
  expect(result.current.phase).toBe('seat');
  // The fern is the starter room's only target and was the last one: KIP stays at its desk.
  r = 0;
  act(() => { jest.advanceTimersByTime((TRIP_MIN_MS + TRIP_SPAN_MS) * 4); });
  expect(result.current.phase).toBe('seat');
});

it('a walking KIP bobs and glances the way it goes; seated there is no mover', () => {
  expect(walkMover({ phase: 'seat' })).toBeNull();
  expect(walkMover({ phase: 'walk', pos: [3, 1.5], depth: [3, 2], flip: true, kind: 'plant', target: 'plant' })).toEqual({ pos: [3, 1.5], depth: [3, 2], flip: true, pose: 'rest', moving: true, sway: false });
  expect(walkMover({ phase: 'use', pos: [3, 2], depth: [3, 2], flip: false, kind: 'sound', target: 'p1' })).toMatchObject({ pose: 'rest', sway: true });
});
