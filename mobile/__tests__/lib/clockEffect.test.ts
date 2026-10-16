import { act, renderHook } from '@testing-library/react-native';
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { TIERS, tierColors } from '../../src/lib/badgeArt';
import { handCells, parseHhmm } from '../../src/lib/room/items/art';
import { clearPieceCache, pieceLayers } from '../../src/lib/room/iso/art';
import { AWARD_COLOURS, awardColour, awardLevels } from '../../src/lib/room/iso/pieces/awards';
import { clockNow, useClockMinute } from '../../src/lib/room/useClockMinute';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());
const WALL = { layer: 'wallR' as const, facing: 'L' as const, mirror: false };

describe('the clock (spec §8.2)', () => {
  it('reads the device\'s local hour and minute', () => {
    expect(clockNow(new Date(2026, 9, 24, 7, 5, 59))).toEqual({ hhmm: '07:05', hour: 7 });
    expect(parseHhmm('23:59')).toEqual({ h: 23, m: 59 });
    expect(parseHhmm('9:5')).toBeNull();
    expect(parseHhmm('24:00')).toBeNull();
  });

  it('points its hands at the time: 03:00 has the hour hand right of the centre, 09:00 left', () => {
    expect(handCells(7, 7, 3, 90).every(([x, y]) => x >= 7 && y === 7)).toBe(true);
    expect(handCells(7, 7, 3, 270).every(([x, y]) => x <= 7 && y === 7)).toBe(true);
    expect(handCells(7, 7, 4, 0).map(([, y]) => y)).toEqual([7, 6, 5, 4, 3]);
  });

  it('running, it shows the real time and no loop; resting, it keeps its old turning hand (ruling 5)', () => {
    const at712 = pieceLayers('art.clock', CTX_DAY, { ...WALL, effect: 'live@07:12' })!;
    const at713 = pieceLayers('art.clock', CTX_DAY, { ...WALL, effect: 'live@07:13' })!;
    expect(at712.frames).toBeUndefined();
    expect(JSON.stringify(at712.base)).not.toBe(JSON.stringify(at713.base));
    expect(pieceLayers('art.clock', CTX_DAY, WALL)!.frames).toHaveLength(3);
  });

  it('useClockMinute ticks once a minute while active, and reads nothing while not', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useClockMinute(on), { initialProps: { on: true } });
    expect(result.current).toEqual({ hhmm: '07:12', hour: 7 });
    act(() => { jest.advanceTimersByTime(31_000); });
    expect(result.current).toEqual({ hhmm: '07:13', hour: 7 });
    rerender({ on: false });
    expect(result.current).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('held (page not focused, a drag live: PF3-CLOCK), it keeps its minute and runs no timer; let go, it reads the time at once', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
    const { result, rerender } = renderHook(({ hold }: { hold: boolean }) => useClockMinute(true, hold), { initialProps: { hold: false } });
    const first = result.current;
    rerender({ hold: true });
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(120_000); });
    expect(result.current).toBe(first);
    rerender({ hold: false });
    expect(result.current).toEqual({ hhmm: '07:14', hour: 7 });
    expect(jest.getTimerCount()).toBe(1);
    jest.useRealTimers();
  });
});

describe('the radio and the trophy shelf (spec §8.2, §8.3)', () => {
  it('a running radio floats three notes up over three frames, dimmed at night; a resting one has no loop', () => {
    const on = pieceLayers('item.radio', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false, effect: 'notes' })!;
    expect(on.frames).toHaveLength(3);
    expect(JSON.stringify(on.frames![0])).not.toBe(JSON.stringify(on.frames![1]));
    const day = pieceLayers('item.radio', CTX_DAY, { layer: 'floor', facing: 'L', mirror: false, effect: 'notes' })!;
    expect(JSON.stringify(on.frames![0])).not.toBe(JSON.stringify(day.frames![0]));
    expect(pieceLayers('item.radio', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false })!.frames).toBeUndefined();
  });

  it('the awards wear the badges\' own tier colours (PF3-COPY): Bronze to Diamond from badgeArt, Legend your KIP\'s', () => {
    expect([1, 2, 3, 4].map((l) => AWARD_COLOURS[l])).toEqual(TIERS.slice(1).map((t) => t.ring));
    expect(awardColour(5, 'coral')).toBe(tierColors(5, 'coral').ring);
    expect(awardColour(5, 'lime')).not.toBe(awardColour(5, 'coral'));
  });

  it('the shelf stands one award per level, highest first, at most 8, in the level\'s colour', () => {
    expect(awardLevels('a54321')).toEqual([5, 4, 3, 2, 1]);
    expect(awardLevels('a5555555555')).toHaveLength(8);
    expect(awardLevels(undefined)).toEqual([]);
    const two = pieceLayers('shelf.awards', CTX_DAY, { ...WALL, effect: 'a53' })!.base!;
    const none = pieceLayers('shelf.awards', CTX_DAY, WALL)!.base!;
    expect(two.length).toBeGreaterThan(none.length);
    expect(two.some(([, , , , c]) => c === awardColour(5, CTX_DAY.colour))).toBe(true);
    expect(two.some(([, , , , c]) => c === AWARD_COLOURS[3])).toBe(true);
    expect(two.some(([, , , , c]) => c === AWARD_COLOURS[1])).toBe(false);
    const left = pieceLayers('shelf.awards', CTX_DAY, { ...WALL, layer: 'wallL', effect: 'a53' })!.base!;
    expect(left.filter(([, , , , c]) => c === AWARD_COLOURS[3]).length).toBe(two.filter(([, , , , c]) => c === AWARD_COLOURS[3]).length);
  });
});
