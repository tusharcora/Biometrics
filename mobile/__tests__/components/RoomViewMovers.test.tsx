import React, { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { LOOP_MS, RoomView, type KipMover, type RoomViewHandle, type RoomViewProps } from '../../src/components/room/RoomView';
import { KIP_POSES } from '../../src/lib/kip/kipArt';
import { PictureLru, RunPictures } from '../../src/components/room/pictureCache';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';

jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => true }));

const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'rest', mood: 'idle', screen: 'lines', crop: { width: 323, height: 240 }, cellPt: 2, bubble: null, reduceMotion: false, testID: 'room',
};
const OUT: KipMover = { pos: [3, 4], depth: [3, 4], flip: false, pose: 'rest', moving: true, sway: false };
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true }).map((p) => p.props.picture);
const groups = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-group', { includeHiddenElements: true });
const transforms = (s: ReturnType<typeof render>) => JSON.stringify(groups(s).map((g) => g.props.skiaTransform));
const disposed = (all: { dispose: jest.Mock }[]) => all.filter((p) => p.dispose.mock.calls.length > 0).length;

beforeEach(() => { picture.mockClear(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

describe('RoomView with movers (spec §3.4, §3.7, rulings 11-12)', () => {
  it('draws the shell, each floor piece, KIP at its tile, the light and the loops, and keeps P1\'s four pictures without movers', () => {
    expect(pictures(render(<RoomView {...PROPS} />))).toHaveLength(4);
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    expect(pictures(s)).toHaveLength(6); // under, the fern, the desk, KIP, the overlay, the loop frame
    const clipped = groups(s).find((g) => g.props.skiaInvertClip);
    expect(clipped?.props.skiaClip).toBeTruthy();
  });

  it('a walk step records nothing: only KIP\'s transform and, at a tile, the order change (Review Focus 5, T10-FIX)', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const before = picture.mock.calls.length;
    const was = transforms(s);
    s.rerender(<RoomView {...PROPS} kipMover={{ ...OUT, pos: [3.5, 4], depth: [4, 4] }} />);
    s.rerender(<RoomView {...PROPS} kipMover={{ ...OUT, pos: [4, 4], depth: [4, 4] }} />);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 6); });
    expect(picture.mock.calls.length - before).toBe(0);
    expect(transforms(s)).not.toEqual(was);
  });

  it('KIP walking behind the bean bag is drawn before it, in front after it (spec §3.4)', () => {
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.beanbag', layer: 'floor' as const, x: 3, y: 5, facing: 'L' as const, mirror: false }] };
    const s = render(<RoomView {...PROPS} layout={layout} kipMover={OUT} />);
    const behind = pictures(s); // under, the fern, the desk, KIP, the bean bag, the overlay, the loop frame
    s.rerender(<RoomView {...PROPS} layout={layout} kipMover={{ ...OUT, pos: [3, 6], depth: [3, 6] }} />);
    const ahead = pictures(s);
    expect(ahead).toEqual([behind[0], behind[1], behind[2], behind[4], behind[3], behind[5], behind[6]]);
  });

  it('bobs a walking KIP one cell on alternate frames, sways it at the radio, and holds both under Reduce Motion', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const ys = new Set<string>();
    for (let i = 0; i < 4; i++) { ys.add(transforms(s)); act(() => { jest.advanceTimersByTime(LOOP_MS); }); }
    expect(ys.size).toBeGreaterThan(1);
    s.unmount();
    const sway = render(<RoomView {...PROPS} kipMover={{ ...OUT, moving: false, sway: true }} />);
    const xs = new Set<string>();
    for (let i = 0; i < 6; i++) { xs.add(transforms(sway)); act(() => { jest.advanceTimersByTime(LOOP_MS); }); }
    expect(xs.size).toBe(3); // 0, +1 and -1 cell, whatever frame the clock starts on
    sway.unmount();
    const still = render(<RoomView {...PROPS} reduceMotion kipMover={{ ...OUT, sway: true }} />);
    const first = transforms(still);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
    expect(transforms(still)).toBe(first);
  });

  it('draws a piece mover at its tile, left out of the picture, and moving it records nothing', () => {
    const s = render(<RoomView {...PROPS} pieceMovers={[{ id: 'plant', pos: [5, 5], depth: [5, 5], flip: false }]} />);
    expect(pictures(s)).toHaveLength(6); // under, the desk, KIP at its seat, the fern mover, the overlay, the loop frame
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pieceMovers={[{ id: 'plant', pos: [5.5, 5], depth: [6, 5], flip: false }]} />);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
    expect(picture.mock.calls.length - before).toBe(0);
  });

  it('a running clock\'s minute re-records the shell, the light and the loops, never a floor piece (Review Focus 5)', () => {
    jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'art.clock', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }] };
    const s = render(<RoomView {...PROPS} layout={layout} kipMover={OUT} />);
    const runsBefore = pictures(s).slice(1, 3);
    const before = picture.mock.calls.length;
    act(() => { jest.advanceTimersByTime(31_000); }); // past the minute's read (PF3-TESTS)
    expect(picture.mock.calls.length - before).toBe(5); // under + overlay + 3 loop frames
    expect(pictures(s).slice(1, 3)).toEqual(runsBefore);
  });

  it('releases what it no longer draws after the commit, never during a render, and everything on unmount (PF3-DISPOSE)', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const runs = pictures(s);
    const all = () => picture.mock.results.map((r) => r.value as { dispose: jest.Mock });
    expect(disposed(all())).toBe(0);
    // KIP sits down again: the runs are let go, P1's two room pictures come back.
    s.rerender(<RoomView {...PROPS} />);
    expect(pictures(s)).toHaveLength(4);
    expect(runs.filter((p) => p.dispose.mock.calls.length > 0)).toEqual([runs[1], runs[2]]); // the fern's and the desk's
    s.unmount();
    expect(disposed(all())).toBe(all().length);
  });

  it('keeps a bounded set of pictures while KIP tries every pose, both ways, in three colours (ruling 13\'s walk revisits them)', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    for (const colour of ['coral', 'cobalt', 'ink'] as const) {
      for (const flip of [false, true]) {
        for (const pose of KIP_POSES) s.rerender(<RoomView {...PROPS} colour={colour} kipMover={{ ...OUT, pose, flip }} />);
      }
    }
    const all = picture.mock.results.map((r) => r.value as { dispose: jest.Mock });
    expect(all.length).toBeGreaterThan(24 * 3 * 2); // far more recorded than the LRU keeps
    // At most the LRU's 24 sets of three (KIP's poses, the shell and overlay, the loop frames), and the two floor pieces.
    expect(all.length - disposed(all)).toBeLessThanOrEqual(24 * 3 + 2);
    for (const p of pictures(s)) expect(p.dispose).not.toHaveBeenCalled(); // never one still on screen
    s.unmount();
    expect(disposed(all)).toBe(all.length);
  });

  it('answers which piece is under a point in the view (the piece card, Task 13)', () => {
    const ref = createRef<RoomViewHandle>();
    render(<RoomView {...PROPS} ref={ref} />);
    expect(ref.current!.pieceAtPoint(-500, -500)).toBeNull();
    let hit: string | null = null;
    for (let x = 0; x < 323 && !hit; x += 4) for (let y = 0; y < 240 && !hit; y += 4) hit = ref.current!.pieceAtPoint(x, y);
    expect(hit).not.toBeNull();
  });
});

describe('the picture caches (ruling 11, PF3-DISPOSE)', () => {
  const pic = () => ({ dispose: jest.fn() }) as unknown as ReturnType<typeof createPicture> & { dispose: jest.Mock };

  it('the LRU records only on a miss and releases its oldest sets in trim, never in get, and never one used since the last trim', () => {
    const lru = new PictureLru(2);
    const [a, b, c] = [[pic()], [pic()], [pic()]];
    expect(lru.get('a', () => a)).toBe(a);
    lru.trim();
    lru.get('b', () => b);
    lru.get('c', () => c);
    expect(lru.get('a', () => [pic()])).toBe(a); // a hit: no new recording
    expect(lru.size).toBe(3); // over capacity until the commit
    expect([a, b, c].map(([p]) => p!.dispose.mock.calls.length)).toEqual([0, 0, 0]);
    lru.trim(); // every set was used since the last trim: none goes
    expect(lru.size).toBe(3);
    lru.get('c', () => c);
    lru.trim(); // only c was used since: the oldest, b, goes, back to capacity
    expect([a, b, c].map(([p]) => p!.dispose.mock.calls.length)).toEqual([0, 1, 0]);
    expect(lru.size).toBe(2);
    lru.clear();
    expect([a[0]!.dispose.mock.calls.length, c[0]!.dispose.mock.calls.length, lru.size]).toEqual([1, 1, 0]);
  });

  it('the run pictures record a key once and release, when told what the room still has, every other one', () => {
    const runs = new RunPictures();
    const [a, b] = [pic(), pic()];
    expect(runs.take('a', () => a)).toBe(a);
    expect(runs.take('a', () => pic())).toBe(a);
    runs.take('b', () => b);
    runs.keep(new Set(['b']));
    expect([a.dispose.mock.calls.length, b.dispose.mock.calls.length]).toEqual([1, 0]);
    runs.clear();
    expect(b.dispose).toHaveBeenCalled();
  });
});
