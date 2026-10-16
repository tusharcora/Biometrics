import React, { createRef } from 'react';
import { act, render, within } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { LOOP_MS, RoomView, type KipMover, type RoomViewHandle, type RoomViewProps } from '../../src/components/room/RoomView';
import { KIP_POSES } from '../../src/lib/kip/kipArt';
import { PictureLru, RunPictures } from '../../src/components/room/pictureCache';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { KIP_MOVER, pieceTileCell } from '../../src/lib/room/iso/movers';
import { NIGHT_VEIL } from '../../src/lib/room/weather';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';

let mockFocused = true;
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => mockFocused }));

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

beforeEach(() => { picture.mockClear(); jest.useFakeTimers(); mockFocused = true; });
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

  it('bobs a walking KIP one cell up on the half steps (the walk, not the loop frame), sways it at the radio, and holds both under Reduce Motion', () => {
    // Each group's y shift in points.
    const kipY = (r: ReturnType<typeof render>) => groups(r).map((g) => g.props.skiaTransform?.[1]?.translateY as number);
    const HALF = { ...OUT, pos: [3.5, 4] as const, depth: [4, 4] as const };
    const glide = render(<RoomView {...PROPS} kipMover={HALF} />);
    const up = kipY(glide);
    for (let i = 0; i < 3; i++) { act(() => { jest.advanceTimersByTime(LOOP_MS); }); expect(kipY(glide)).toEqual(up); }
    glide.rerender(<RoomView {...PROPS} kipMover={{ ...HALF, moving: false }} />);
    const level = kipY(glide);
    // With the bob off, KIP and its outline clip move one cell (2 pt) down, and the loops under the clip stay put.
    const moved = up.map((y, k) => (y === level[k] ? 0 : level[k]! - y)).filter((d) => d !== 0);
    expect(moved).toEqual([2, 2, -2]);
    glide.unmount();
    // On a whole tile there is no bob, whatever the frame.
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const ys = new Set<string>();
    for (let i = 0; i < 4; i++) { ys.add(transforms(s)); act(() => { jest.advanceTimersByTime(LOOP_MS); }); }
    expect(ys.size).toBe(1);
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

  it('a trip off the seat and back records the room once; a new room lets the old one go after the commit (PF3-DISPOSE, T9-FIX M1-M2)', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    s.rerender(<RoomView {...PROPS} kipMover={OUT} />);
    const [under, fern, desk, , overlay, loop] = pictures(s);
    const all = () => picture.mock.results.map((r) => r.value as { dispose: jest.Mock });
    // KIP sits down and walks off again: the same pictures, nothing new recorded, nothing released.
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} />);
    expect([pictures(s)[0], pictures(s)[2]]).toEqual([back, front]);
    s.rerender(<RoomView {...PROPS} kipMover={OUT} />);
    expect(pictures(s)).toEqual([under, fern, desk, pictures(s)[3], overlay, loop]);
    expect(picture.mock.calls.length - before).toBe(0);
    expect(disposed(all())).toBe(0);
    // The fern moves: its run, the old shell, overlay, loop frames, back and front go; the desk's run stays.
    const moved = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'plant' ? { ...p, x: 1, y: 5 } : p)) };
    s.rerender(<RoomView {...PROPS} layout={moved} kipMover={OUT} />);
    const gone = (p: { dispose: jest.Mock }) => p.dispose.mock.calls.length > 0;
    expect([back, front, under, overlay, loop, fern].every(gone)).toBe(true);
    expect(gone(desk)).toBe(false);
    expect(pictures(s)).toContain(desk);
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

  describe('the wandering cat and KIP\'s outline (ruling T9-FIX)', () => {
    const CAT = { id: 'p1', item: 'pet.tabby', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false };
    const CAT_ROOM = { ...starterLayout(), pieces: [...starterLayout().pieces, CAT] };
    const WANDER = [{ id: 'p1', pos: [5, 5] as const, depth: [5, 5] as const, flip: false }];
    const pictureIn = (g: ReturnType<typeof groups>[number]) => within(g).getByTestId('skia-picture', { includeHiddenElements: true }).props.picture;

    it('at night the cat\'s base stands at its depth under the veil, its loop frame over the veil, unclipped (I1)', () => {
      const s = render(<RoomView {...PROPS} night layout={CAT_ROOM} pieceMovers={WANDER} />);
      const all = pictures(s);
      const veil = all.findIndex((p) => p.colours.includes(NIGHT_VEIL));
      const [x, y] = pieceTileCell(isoGrid(1), [5, 5]);
      const at = JSON.stringify([{ translateX: x * 2 }, { translateY: y * 2 }]);
      const cat = groups(s).filter((g) => JSON.stringify(g.props.skiaTransform) === at);
      expect(cat).toHaveLength(2);
      const [base, loop] = cat.map((g) => all.indexOf(pictureIn(g)));
      expect(base).toBeLessThan(veil);
      expect(loop).toBeGreaterThan(veil);
      expect(cat.some((g) => g.props.skiaClip)).toBe(false);
    });

    it('a cat-only room keeps KIP seated: the seated loop frames, no inverted clip (I2)', () => {
      const s = render(<RoomView {...PROPS} layout={CAT_ROOM} pieceMovers={WANDER} />);
      expect(groups(s).some((g) => g.props.skiaInvertClip)).toBe(false);
      expect(groups(s).some((g) => g.props.skiaClip)).toBe(false);
    });

    it('releases KIP\'s outline paths when the pose changes and when the view goes (I3)', () => {
      const s = render(<RoomView {...PROPS} kipMover={OUT} />);
      const clip = () => groups(s).find((g) => g.props.skiaInvertClip)!.props.skiaClip as { dispose: jest.Mock };
      const first = clip();
      expect(first.dispose).not.toHaveBeenCalled();
      s.rerender(<RoomView {...PROPS} kipMover={{ ...OUT, pose: 'point' }} />);
      const second = clip();
      expect([first.dispose.mock.calls.length > 0, second.dispose.mock.calls.length]).toEqual([true, 0]);
      s.unmount();
      expect(second.dispose).toHaveBeenCalled();
    });
  });

  describe('the cat wandering the front row (Task 11, ruling 10)', () => {
    const cat = { id: 'p1', item: 'pet.tabby', layer: 'floor' as const, x: 5, y: 3, facing: 'L' as const, mirror: false };
    const bed = { id: 'p2', item: 'pet.bed', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false };
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat, bed] };
    const living = { plantStage: 5 as const, petEnergy: 'wander' as const, awards: [] };
    const LIVE = { ...PROPS, layout, living, live: true };

    it('the KIP page\'s room lets the cat wander; Reduce Motion, the night and other rooms keep it still (Review Focus 4)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
      // under, the fern, the desk and the bed (three runs), KIP at its seat, the cat mover, the overlay, the cat's own
      // loop frame over it (its tail, ruling T9-FIX I1), the room's loop frame.
      expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} live />))).toHaveLength(9);
      expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} live reduceMotion />))).toHaveLength(4);
      expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} />))).toHaveLength(4);
      jest.setSystemTime(new Date(2026, 9, 24, 23, 0, 0));
      const night = render(<RoomView {...PROPS} layout={layout} living={living} live reduceMotion />);
      expect(pictures(night)).toHaveLength(4); // curled on its bed, in the static room
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(400 * 3); });
      expect(picture.mock.calls.length - before).toBe(0);
    });

    it('at nap time the loops run, the cat stays on its bed and nothing is recorded (ruling 10)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 23, 0, 0));
      const night = render(<RoomView {...LIVE} />);
      expect(pictures(night)).toHaveLength(4);
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(LOOP_MS * 12); });
      expect(picture.mock.calls.length - before).toBe(0);
      expect(pictures(night)).toHaveLength(4);
    });

    it('a step records nothing: after one round both ways, a whole round records 0 pictures (Review Focus 5)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
      const s = render(<RoomView {...LIVE} />);
      const seen = new Set<string>();
      for (let k = 0; k < 60; k++) { seen.add(transforms(s)); act(() => { jest.advanceTimersByTime(LOOP_MS); }); }
      expect(seen.size).toBeGreaterThan(5); // it really walks
      const before = picture.mock.calls.length;
      for (let k = 0; k < 60; k++) act(() => { jest.advanceTimersByTime(LOOP_MS); });
      expect(picture.mock.calls.length - before).toBe(0);
      expect(pictures(s)).toHaveLength(9);
    });

    it('holds like KIP: unfocused, paused, under the collapsed header, Reduce Motion or the editor put it on its own tile in that render', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
      for (const hold of [{ paused: true }, { holdClock: true }, { reduceMotion: true }, { editing: true }, { unfocused: true }]) {
        const { unfocused, ...over } = { unfocused: false, ...hold };
        const s = render(<RoomView {...LIVE} />);
        act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
        expect(pictures(s)).toHaveLength(9);
        mockFocused = !unfocused;
        s.rerender(<RoomView {...LIVE} {...over} />);
        // No mover: the static room, the cat drawn in it at its placement, and no step pending.
        expect(pictures(s)).toHaveLength(4);
        const before = picture.mock.calls.length;
        act(() => { jest.advanceTimersByTime(LOOP_MS * 6); });
        expect([JSON.stringify(hold), picture.mock.calls.length - before]).toEqual([JSON.stringify(hold), 0]);
        s.unmount();
        mockFocused = true;
      }
    });

    it('KIP up from its seat: the cat waits on a whole tile until KIP sits again (KIP and the cat never share a tile)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
      const s = render(<RoomView {...LIVE} />);
      act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
      s.rerender(<RoomView {...LIVE} kipMover={{ ...OUT, pos: [1, 4], depth: [1, 4] }} />);
      const waiting = transforms(s);
      act(() => { jest.advanceTimersByTime(LOOP_MS * 8); });
      expect(transforms(s)).toBe(waiting);
      s.rerender(<RoomView {...LIVE} />);
      act(() => { jest.advanceTimersByTime(LOOP_MS * 4); });
      expect(transforms(s)).not.toBe(waiting);
    });
  });

  it('a clock render between two loop frames re-renders none of the floor pieces (T9-FIX M3)', () => {
    const many = Array.from({ length: 12 }, (_, k): Placement => ({ id: `f${k}`, item: 'plant.cactus', layer: 'floor', x: k % 6, y: 4 + Math.floor(k / 6), facing: 'L', mirror: false }));
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, ...many] };
    const { __pictureRenders: draws } = jest.requireMock('@shopify/react-native-skia') as { __pictureRenders: () => number };
    const s = render(<RoomView {...PROPS} layout={layout} kipMover={{ ...OUT, moving: false }} />);
    expect(pictures(s).length).toBeGreaterThan(14);
    const perTick: number[] = [];
    for (let i = 0; i < 8; i++) {
      const was = draws();
      act(() => { jest.advanceTimersByTime(60); });
      perTick.push(draws() - was);
    }
    // Only the shell, the overlay and the loop frame, and on a new loop frame KIP too: never a floor piece.
    expect(Math.min(...perTick)).toBeGreaterThan(0); // the count does see the draws
    expect(Math.max(...perTick)).toBeLessThanOrEqual(4);
  });

  it('answers which piece is under a point in the view (the piece card, Task 13)', () => {
    const ref = createRef<RoomViewHandle>();
    render(<RoomView {...PROPS} ref={ref} />);
    expect(ref.current!.pieceAtPoint(-500, -500)).toBeNull();
    let hit: string | null = null;
    for (let x = 0; x < 323 && !hit; x += 4) for (let y = 0; y < 240 && !hit; y += 4) hit = ref.current!.pieceAtPoint(x, y);
    expect(hit).not.toBeNull();
  });

  // Every point of the view, by what a tap there finds.
  const hitsOf = (ref: React.RefObject<RoomViewHandle | null>) => {
    const found = new Map<string, Array<[number, number]>>();
    for (let x = 0; x < 323; x += 2) for (let y = 0; y < 240; y += 2) {
      const id = ref.current!.pieceAtPoint(x, y);
      if (id) found.set(id, [...(found.get(id) ?? []), [x, y]]);
    }
    return found;
  };

  it('a tap finds a wandering piece where its sprite is drawn, not where it was placed (T13-CARRY)', () => {
    const ref = createRef<RoomViewHandle>();
    const s = render(<RoomView {...PROPS} ref={ref} />);
    const placed = hitsOf(ref).get('plant')!;
    expect(placed.length).toBeGreaterThan(0);
    s.rerender(<RoomView {...PROPS} ref={ref} pieceMovers={[{ id: 'plant', pos: [5, 5], depth: [5, 5], flip: false }]} />);
    const moved = hitsOf(ref).get('plant') ?? [];
    expect(moved.length).toBeGreaterThan(0);
    // Found where the sprite stands now, a few tiles from its placement: none of its old points.
    const was = new Set(placed.map(([x, y]) => `${x},${y}`));
    expect(moved.filter(([x, y]) => was.has(`${x},${y}`))).toEqual([]);
  });

  // What a tap finds at every point of the view, point by point.
  const pointMap = (ref: React.RefObject<RoomViewHandle | null>) => {
    const out: Array<string | null> = [];
    for (let x = 0; x < 323; x += 2) for (let y = 0; y < 240; y += 2) out.push(ref.current!.pieceAtPoint(x, y));
    return out;
  };

  it('a tap on a walking KIP finds the piece behind it, never KIP, and a wandering piece behind KIP is still found (T13-TAP)', () => {
    const beanbag = { id: 'p1', item: 'corner.beanbag', layer: 'floor' as const, x: 3, y: 5, facing: 'L' as const, mirror: false };
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, beanbag] };
    const ref = createRef<RoomViewHandle>();
    const s = render(<RoomView {...PROPS} layout={layout} ref={ref} />);
    const seated = pointMap(ref);
    expect(seated).toContain('p1');
    // KIP walks in front of the bean bag: every point finds what it found with KIP at its desk.
    s.rerender(<RoomView {...PROPS} layout={layout} ref={ref} kipMover={{ ...OUT, pos: [3, 6], depth: [3, 6] }} />);
    const walking = pointMap(ref);
    // Compared as counts, so a failure reads short: points that found KIP, and points that changed.
    const changed = (a: Array<string | null>, b: Array<string | null>) => a.filter((id, k) => id !== b[k]).length;
    expect({ kip: walking.filter((id) => id === KIP_MOVER).length, changed: changed(walking, seated) }).toEqual({ kip: 0, changed: 0 });
    // A wandering fern behind the walking KIP is found just as it is without KIP out.
    const fern = [{ id: 'plant', pos: [3, 4] as const, depth: [3, 4] as const, flip: false }];
    s.rerender(<RoomView {...PROPS} layout={layout} ref={ref} pieceMovers={fern} />);
    const alone = pointMap(ref);
    expect(alone).toContain('plant');
    s.rerender(<RoomView {...PROPS} layout={layout} ref={ref} pieceMovers={fern} kipMover={{ ...OUT, pos: [3, 5], depth: [3, 5] }} />);
    expect(changed(pointMap(ref), alone)).toBe(0);
  });

  it('a tap goes to the topmost thing in depth order: a cat behind a tall floor piece loses it, a cat in front wins (FINAL-FIX M1)', () => {
    const lampAt = (x: number, y: number) => ({ id: 'p1', item: 'corner.floorlamp', layer: 'floor' as const, x, y, facing: 'L' as const, mirror: false });
    const cat = { id: 'c1', item: 'pet.tabby', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false };
    const at = (ids: Array<string | null>, id: string) => new Set(ids.flatMap((v, k) => (v === id ? [k] : [])));
    // Where the lamp and the cat both have opaque cells, each drawn alone; then what a tap there finds with both.
    // The cat is drawn at `walk` and sorted at `depth`: the same cells, only the depth differs.
    const overlap = (lamp: [number, number], walk: [number, number], depth: [number, number]) => {
      const ref = createRef<RoomViewHandle>();
      const mover = [{ id: 'c1', pos: walk, depth, flip: false }];
      const base = starterLayout().pieces;
      const s = render(<RoomView {...PROPS} ref={ref} layout={{ ...starterLayout(), pieces: [...base, lampAt(...lamp)] }} />);
      const lampCells = at(pointMap(ref), 'p1');
      s.rerender(<RoomView {...PROPS} ref={ref} layout={{ ...starterLayout(), pieces: [...base, cat] }} pieceMovers={mover} />);
      const catCells = at(pointMap(ref), 'c1');
      s.rerender(<RoomView {...PROPS} ref={ref} layout={{ ...starterLayout(), pieces: [...base, lampAt(...lamp), cat] }} pieceMovers={mover} />);
      const both = pointMap(ref);
      const shared = [...lampCells].filter((k) => catCells.has(k));
      s.unmount();
      return { shared: shared.length > 0, found: [...new Set(shared.map((k) => both[k]))] };
    };
    // The cat walks behind the lamp (a smaller i + j): the lamp is drawn over it, so the lamp takes the tap.
    expect(overlap([3, 5], [2, 4], [2, 4])).toEqual({ shared: true, found: ['p1'] });
    // The same cells with the cat in front of it in depth: the cat is drawn over the lamp and takes the tap.
    expect(overlap([3, 5], [2, 4], [4, 6])).toEqual({ shared: true, found: ['c1'] });
  });

  it('a tap finds a wandering cat (pet.tabby) where it walks (T13-FIX M4)', () => {
    const cat = { id: 'c1', item: 'pet.tabby', layer: 'floor' as const, x: 1, y: 6, facing: 'L' as const, mirror: false };
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat] };
    const ref = createRef<RoomViewHandle>();
    render(<RoomView {...PROPS} layout={layout} ref={ref} pieceMovers={[{ id: 'c1', pos: [4, 5], depth: [4, 5], flip: false }]} />);
    expect(pointMap(ref)).toContain('c1');
  });

  it('a tapped piece squashes over two frames and springs back; never under Reduce Motion (ruling 17)', () => {
    const ref = createRef<RoomViewHandle>();
    const s = render(<RoomView {...PROPS} ref={ref} />);
    const [back, , front] = pictures(s);
    act(() => ref.current!.squash('plant'));
    expect(pictures(s)[0] !== back || pictures(s)[2] !== front).toBe(true);
    act(() => { jest.advanceTimersByTime(800); });
    const calm = render(<RoomView {...PROPS} ref={ref} reduceMotion />);
    const before = picture.mock.calls.length;
    act(() => ref.current!.squash('plant'));
    expect(picture.mock.calls.length - before).toBe(0);
    calm.unmount();
  });

  it('the squash draws two different frames 400 ms apart, then as many pictures as at rest, after which the ticks record nothing; an unmount leaves no timer (ruling 17, PF3-SQUASH)', () => {
    const ref = createRef<RoomViewHandle>();
    const s = render(<RoomView {...PROPS} ref={ref} />);
    const rest = pictures(s);
    act(() => ref.current!.squash('plant'));
    const one = pictures(s);
    act(() => { jest.advanceTimersByTime(LOOP_MS); });
    const two = pictures(s);
    expect(two).not.toEqual(one);
    act(() => { jest.advanceTimersByTime(LOOP_MS); });
    const after = picture.mock.calls.length;
    expect(pictures(s)).toHaveLength(rest.length);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 6); });
    expect(picture.mock.calls.length - after).toBe(0); // back at rest, the ticks record nothing again
    act(() => ref.current!.squash('plant'));
    s.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('the picture caches (ruling 11, PF3-DISPOSE)', () => {
  const pic = () => ({ dispose: jest.fn() }) as unknown as ReturnType<typeof createPicture> & { dispose: jest.Mock };

  it('the LRU records only on a miss and releases in trim, never in get: another room\'s sets, then the oldest, never a drawn one', () => {
    const lru = new PictureLru(2);
    const [a, b, c, k] = [[pic()], [pic()], [pic()], [pic()]];
    const gone = () => [a, b, c, k].map(([p]) => p!.dispose.mock.calls.length);
    expect(lru.get('a', () => a, 'room1')).toBe(a);
    lru.get('b', () => b, 'room1');
    lru.get('k', () => k); // KIP's: no room
    expect(lru.get('a', () => [pic()], 'room1')).toBe(a); // a hit: no new recording
    lru.get('c', () => c, 'room2');
    expect([lru.size, ...gone()]).toEqual([4, 0, 0, 0, 0]); // over the size until the commit
    // a is still drawn: it stays; b is room1's and not drawn: it goes; then past the size the oldest undrawn, k, goes.
    lru.trim(new Set(['a', 'c']), 'room2');
    expect([lru.size, ...gone()]).toEqual([2, 0, 1, 0, 1]);
    lru.trim(new Set(['c']), 'room2'); // a is room1's and no longer drawn: it goes
    expect([lru.size, ...gone()]).toEqual([1, 1, 1, 0, 1]);
    lru.get('d', () => [pic()], 'room2');
    lru.trim(new Set(['d']), 'room2'); // within the size, a set of this room stays though it is not drawn
    expect([lru.size, ...gone()]).toEqual([2, 1, 1, 0, 1]);
    lru.clear();
    expect([lru.size, c[0]!.dispose.mock.calls.length]).toEqual([0, 1]);
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
