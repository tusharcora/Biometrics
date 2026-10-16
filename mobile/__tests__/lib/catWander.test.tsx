import { act, renderHook } from '@testing-library/react-native';
import { roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { deskBoxes, isoCrop } from '../../src/lib/room/iso/crop';
import { tierSize } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { PAUSE_STEPS, catAt, catRoute, takenTiles, useCatWander, wanderRoutes } from '../../src/lib/room/live/catWander';
import { STEP_MS, blockedTiles, tileInView } from '../../src/lib/room/live/walk';

const cat: Placement = { id: 'p1', item: 'pet.tabby', layer: 'floor', x: 5, y: 3, facing: 'L', mirror: false };
const layout: RoomLayout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat] };
const DAY = { hhmm: '12:00', hour: 12 };
const wander = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, DAY);
/** The KIP page's room card crop in room cells (the walk tests' `card`). */
const CARD = { x: 10.5, y: 19, w: 161.5, h: 120 };

it('goes to the nearest free tile of the front row, then up to 3 tiles along it (spec §8.2, ruling 10)', () => {
  expect(catRoute(layout, 1, cat)).toEqual([[5, 3], [5, 4], [5, 5], [5, 6], [4, 6], [3, 6], [2, 6]]);
  const box = [[4, 3], [6, 3], [5, 2], [5, 4]].map(([x, y], k): Placement => ({ id: `b${k}`, item: 'corner.beanbag', layer: 'floor', x: x!, y: y!, facing: 'L', mirror: false }));
  expect(catRoute({ ...layout, pieces: [...layout.pieces, ...box] }, 1, cat)).toBeNull(); // boxed in: it sits
});

it('walks only over tiles inside the crop, and never over KIP\'s seat or the tile out of it (Task 10\'s restriction)', () => {
  const g = isoGrid(1);
  const route = catRoute(layout, 1, cat, undefined, CARD)!;
  // Of the front row only tiles 2 to 4 are in the card: the nearest is [4, 6], then 2 more along it.
  expect(route[route.length - 1]).toEqual([2, 6]);
  expect(route.slice(1).every((t) => tileInView(g, t, CARD))).toBe(true);
  // A cat beside the desk walks round KIP's seat [3, 1] and its exit tile [3, 2], though both are free floor.
  const byDesk: Placement = { ...cat, x: 4, y: 1 };
  const near = catRoute({ ...starterLayout(), pieces: [...starterLayout().pieces, byDesk] }, 1, byDesk)!;
  expect(near.some(([i, j]) => i === 3 && (j === 1 || j === 2))).toBe(false);
  expect(near[near.length - 1]![1]).toBe(6);
});

describe('the front row in bigger rooms (ruling T11-ROW)', () => {
  // The page's card as RoomView crops it: 323 × 240 pt at 2 pt a cell, centred on the starter desk.
  const cardView = (tier: 2 | 3) => {
    const g = isoGrid(tier);
    const off = isoCrop({ width: 323, height: 240, cellPt: 2, box: deskBoxes(g, starterLayout()).focus, room: g });
    return { x: -off.x / 2, y: -off.y / 2, w: 323 / 2, h: 240 / 2 };
  };
  const free = (l: RoomLayout, tier: 1 | 2 | 3, view: typeof CARD, j: number) => {
    const g = isoGrid(tier);
    const blocked = blockedTiles(l);
    return Array.from({ length: tierSize(tier).n }, (_, i) => i).filter((i) => !blocked.has(`${i},${j}`) && tileInView(g, [i, j], view) && !(i === 3 && j <= 2)).length;
  };

  it.each([2, 3] as const)('tier %i: the crop cuts off j = m − 1, so it walks the frontmost row the card shows 2 tiles of', (tier) => {
    const view = cardView(tier);
    const { m } = tierSize(tier);
    expect(free(layout, tier, view, m - 1)).toBeLessThan(2); // the old rule: no route at all
    const route = catRoute(layout, tier, cat, undefined, view)!;
    expect(route).not.toBeNull();
    const row = route[route.length - 1]![1];
    expect(free(layout, tier, view, row)).toBeGreaterThanOrEqual(2);
    for (let j = row + 1; j < m; j++) expect(free(layout, tier, view, j)).toBeLessThan(2);
    expect(route.slice(1).every((t) => tileInView(isoGrid(tier), t, view))).toBe(true);
    expect(route.some(([i, j]) => i === 3 && (j === 1 || j === 2))).toBe(false); // KIP's seat and exit
  });

  it('tier 1: the front row is still j = m − 1 while the card shows 2 of its tiles; with none free anywhere it sits', () => {
    expect(free(layout, 1, CARD, 6)).toBeGreaterThanOrEqual(2);
    expect(catRoute(layout, 1, cat, undefined, CARD)!.slice(-1)[0]![1]).toBe(6);
    expect(catRoute(layout, 1, cat, undefined, { x: -1000, y: -1000, w: 1, h: 1 })).toBeNull();
  });
});

it('a second wandering cat plans round the first one\'s route: two tabbies never share a tile', () => {
  const two: Placement = { ...cat, id: 'p2', x: 4, y: 3 };
  const l = { ...layout, pieces: [...layout.pieces, two] };
  const routes = wanderRoutes(l, 1, roomEffects(l, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, DAY));
  expect(routes.map((r) => r.id)).toEqual(['p1', 'p2']);
  const first = new Set(routes[0]!.path.map(([i, j]) => `${i},${j}`));
  expect(routes[1]!.path.some(([i, j]) => first.has(`${i},${j}`))).toBe(false);
  expect(routes[0]!.path).toEqual(catRoute(layout, 1, cat)); // the first cat's own way is unchanged
});

it('only a running cat in the wander state wanders: playing, napping or resting it stays put', () => {
  expect(wanderRoutes(layout, 1, wander).map((r) => r.id)).toEqual(['p1']);
  expect(wanderRoutes(layout, 1, roomEffects(layout, 1, { plantStage: 5, petEnergy: 'play', awards: [] }, DAY))).toEqual([]);
  expect(wanderRoutes(layout, 1, roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, { hhmm: '22:30', hour: 22 }))).toEqual([]);
});

it('walks out half a tile a step, pauses 2.4 s, walks home and pauses again, facing the way it goes', () => {
  const route = { id: 'p1', path: catRoute(layout, 1, cat)! };
  const S = 2 * (route.path.length - 1);
  expect(catAt(route, 0)).toMatchObject({ pos: [5, 3] });
  expect(catAt(route, 1)).toMatchObject({ pos: [5, 3.5], depth: [5, 4] });
  expect(catAt(route, S)).toMatchObject({ pos: [2, 6] });
  expect(catAt(route, S + PAUSE_STEPS - 1)).toMatchObject({ pos: [2, 6] });
  expect(catAt(route, 2 * S + PAUSE_STEPS)).toMatchObject({ pos: [5, 3] });
  // Along the front row toward lower i, (i − j) falls: it heads left, mirrored.
  expect([catAt(route, S - 2).flip, catAt(route, S - 1).flip]).toEqual([true, true]);
  // Each step names the tile it goes to next, for KIP to keep off (KIP and the cat never share a tile).
  expect(catAt(route, 0).next).toEqual([5, 4]);
  expect(catAt(route, S).next).toEqual([2, 6]);
  expect([...takenTiles([catAt(route, 1)])].sort()).toEqual(['5,3', '5,4']);
  expect([...takenTiles([catAt(route, 2)])].sort()).toEqual(['5,4', '5,5']);
});

describe('useCatWander (Task 10\'s timer pattern: one pending timer)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  type P = { on: boolean; l?: RoomLayout; waits?: boolean };
  const hook = (initialProps: P) => renderHook(({ on, l = layout, waits }: P) => useCatWander({ enabled: on, layout: l, tier: 1, effects: wander, waits }), { initialProps });

  it('useCatWander steps every 400 ms while enabled, and nothing while not', () => {
    const { result, rerender } = hook({ on: true });
    const first = result.current[0]!.pos;
    act(() => { jest.advanceTimersByTime(STEP_MS * 2); });
    expect(result.current[0]!.pos).not.toEqual(first);
    rerender({ on: false });
    expect(result.current).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps one pending timer, and starts from home again when enabled once more', () => {
    const { result, rerender } = hook({ on: true });
    expect(jest.getTimerCount()).toBe(1);
    act(() => { jest.advanceTimersByTime(STEP_MS * 3); });
    expect(jest.getTimerCount()).toBe(1);
    expect(result.current[0]!.pos).toEqual([5, 4.5]);
    rerender({ on: false });
    rerender({ on: true });
    expect(result.current[0]!.pos).toEqual([5, 3]); // in that same render, before any timer
  });

  it('a new room mid-walk sends it home in the same render, and the round starts over', () => {
    const { result, rerender } = hook({ on: true });
    act(() => { jest.advanceTimersByTime(STEP_MS * 3); });
    const moved = { ...layout, pieces: layout.pieces.map((p) => (p.id === 'plant' ? { ...p, x: 1, y: 5 } : p)) };
    rerender({ on: true, l: moved });
    expect(result.current[0]!.pos).toEqual([5, 3]);
    expect(jest.getTimerCount()).toBe(1);
  });

  it('waits while KIP is up: on the whole tile it was stepping onto, no timer, then goes on from there (T11-ROW)', () => {
    const { result, rerender } = hook({ on: true });
    act(() => { jest.advanceTimersByTime(STEP_MS * 3); }); // half way from [5, 4] to [5, 5]
    rerender({ on: true, waits: true });
    expect(result.current[0]).toMatchObject({ pos: [5, 5], depth: [5, 5], next: [5, 6] });
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(STEP_MS * 10); });
    expect(result.current[0]!.pos).toEqual([5, 5]);
    // KIP sits: in that render it is still on [5, 5], never half a tile back, and the next step goes on forward.
    rerender({ on: true, waits: false });
    expect(result.current[0]!.pos).toEqual([5, 5]);
    act(() => { jest.advanceTimersByTime(STEP_MS); });
    expect(result.current[0]!.pos).toEqual([5, 5.5]);
  });

  it('leaves no timer when it goes, and none at nap time', () => {
    const { unmount } = hook({ on: true });
    act(() => { jest.advanceTimersByTime(STEP_MS * 3); });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    const night = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, { hhmm: '23:00', hour: 23 });
    const { result } = renderHook(() => useCatWander({ enabled: true, layout, tier: 1, effects: night }));
    expect(result.current).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
