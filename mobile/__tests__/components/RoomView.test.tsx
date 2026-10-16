import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { bubbleAnchor, LOOP_MS, RoomView, type RoomViewProps } from '../../src/components/room/RoomView';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';
import { isoCrop } from '../../src/lib/room/iso/crop';
import * as isoRoom from '../../src/lib/room/iso/room';
import { drawIsoFramesEach, drawIsoStatic, drawKipLayer } from '../../src/lib/room/iso/room';
import type { RoomRect } from '../../src/lib/room/grid';
import type { Placement } from '../../src/lib/room/iso/geometry';

let mockFocused = true;
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => mockFocused }));

const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'type', mood: 'glance', screen: 'dots', crop: { width: 323, height: 240 }, cellPt: 2,
  bubble: 'ON IT…', reduceMotion: false, accessibilityLabel: 'KIP in its room, typing. Window: cloudy', testID: 'room',
};
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true }).map((p) => p.props.picture);
const STATIC = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral' });

beforeEach(() => {
  mockFocused = true;
  picture.mockClear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('RoomView (iso)', () => {
  it('draws back, KIP, front and the loop frame, moved by the crop on the desk', () => {
    const s = render(<RoomView {...PROPS} />);
    expect(pictures(s)).toHaveLength(4);
    const o = isoCrop({ width: 323, height: 240, cellPt: 2, box: STATIC.focus, room: STATIC.grid });
    expect(s.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: o.x }, { translateY: o.y }]);
  });

  it('draws the thumbnail at 1 point a cell on the desk, and an editor offset when one is given', () => {
    const thumb = render(<RoomView {...PROPS} cellPt={1} box="thumb" crop={{ width: 96, height: 60 }} bubble={null} />);
    const o = isoCrop({ width: 96, height: 60, cellPt: 1, box: STATIC.thumb, room: STATIC.grid });
    expect(thumb.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: o.x }, { translateY: o.y }]);
    thumb.unmount();
    const edit = render(<RoomView {...PROPS} offset={{ x: -12, y: 4 }} />);
    expect(edit.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: -12 }, { translateY: 4 }]);
  });

  it('a pose change keeps the room\'s pictures: KIP\'s 3 frames and the 3 loop frames (clipped by KIP) are re-recorded, the old ones released', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, kip, front, frame] = pictures(s);
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pose="point" mood="glance" />);
    const [back2, , front2] = pictures(s);
    expect([back2, front2]).toEqual([back, front]);
    expect(picture.mock.calls.length - before).toBe(6);
    expect([kip.dispose, frame.dispose].every((d: jest.Mock) => d.mock.calls.length > 0)).toBe(true);
  });

  it('a loop tick records nothing: it picks KIP and the loop frame from the pictures it has (ruling T10-FIX)', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, kip, front, frame] = pictures(s);
    const before = picture.mock.calls.length;
    act(() => { jest.advanceTimersByTime(LOOP_MS); });
    const after = pictures(s);
    expect([after[0], after[2]]).toEqual([back, front]);
    expect(after[1] !== kip || after[3] !== frame).toBe(true);
    const seen = new Set([kip, after[1]]);
    for (let i = 0; i < 6; i++) {
      act(() => { jest.advanceTimersByTime(LOOP_MS); });
      seen.add(pictures(s)[1]);
    }
    expect(picture.mock.calls.length - before).toBe(0);
    expect(seen.size).toBeLessThanOrEqual(3); // the same three KIP pictures, picked by frame
  });

  it('each loop frame behind KIP is clipped by KIP\'s silhouette in that same frame', () => {
    const kips = [0, 1, 2].map((f) => drawKipLayer({ colour: 'coral', pose: 'type', mood: 'glance', worn: EMPTY_WORN, frame: f }, STATIC.kipSeat)) as [RoomRect[], RoomRect[], RoomRect[]];
    const each = drawIsoFramesEach(STATIC, { night: false, colour: 'coral', screen: 'dots' }, kips);
    const cells = (rects: readonly RoomRect[]) => {
      const out = new Set<string>();
      for (const [x, y, w, h] of rects) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) out.add(`${x + i},${y + j}`);
      return out;
    };
    for (const k of [0, 1, 2] as const) {
      const kip = cells(kips[k]);
      expect(each[k].length).toBeGreaterThan(0);
      expect([...cells(each[k])].some((c) => kip.has(c))).toBe(false);
    }
  });

  it('draws a static room it is given without building its own (final review M2)', () => {
    const build = jest.spyOn(isoRoom, 'drawIsoStatic');
    const s = render(<RoomView {...PROPS} room={STATIC} />);
    expect(build).not.toHaveBeenCalled();
    expect(pictures(s)).toHaveLength(4);
    s.rerender(<RoomView {...PROPS} room={undefined} hide="rug" />);
    expect(build).toHaveBeenCalledTimes(1);
    build.mockRestore();
  });

  it('a lifted piece rebuilds the room without it, and the old room pictures are released', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    s.rerender(<RoomView {...PROPS} hide="rug" />);
    expect(pictures(s)[0]).not.toBe(back);
    expect([back.dispose, front.dispose].every((d: jest.Mock) => d.mock.calls.length > 0)).toBe(true);
  });

  it('a moved desk moves KIP, even with the same pose', () => {
    const s = render(<RoomView {...PROPS} />);
    const [, kip] = pictures(s);
    const moved = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'desk' ? { ...p, y: 4 } : p)) };
    s.rerender(<RoomView {...PROPS} layout={moved} />);
    expect(pictures(s)[1]).not.toBe(kip);
  });

  it('runs the 3-frame loop at 400 ms a frame', () => {
    const s = render(<RoomView {...PROPS} />);
    const seen = new Set([pictures(s)[3]]);
    for (let i = 0; i < 3; i++) {
      act(() => { jest.advanceTimersByTime(LOOP_MS); });
      seen.add(pictures(s)[3]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it.each([
    ['under Reduce Motion', { reduceMotion: true }, true],
    ['when the tab is not focused', {}, false],
    ['while paused (the editor is open)', { paused: true }, true],
  ] as const)('holds the first frame %s', (_label, extra, focused) => {
    mockFocused = focused;
    const s = render(<RoomView {...PROPS} {...extra} />);
    const [, kip, , frame] = pictures(s);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 4); });
    expect([pictures(s)[1], pictures(s)[3]]).toEqual([kip, frame]);
  });

  it('is one image with one label; the bubble is decorative and sits above KIP\'s head', () => {
    const s = render(<RoomView {...PROPS} />);
    const room = s.getByTestId('room');
    expect([room.props.accessibilityRole, room.props.accessibilityLabel]).toEqual(['image', 'KIP in its room, typing. Window: cloudy']);
    expect(s.getByTestId('room-bubble', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(bubbleAnchor(STATIC.kipSeat)).toEqual({ x: STATIC.kipSeat.x + 16, y: STATIC.kipSeat.y + 10 });
  });

  it.each([280, 323])('keeps a measured bubble inside the %i-point crop, 4 points from either edge', (width) => {
    const s = render(<RoomView {...PROPS} bubble="HERE'S MY TAKE" crop={{ width, height: 240 }} />);
    const bubble = () => s.getByTestId('room-bubble', { includeHiddenElements: true });
    act(() => { fireEvent(bubble(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 135, height: 20 } } }); });
    const { left } = bubble().props.style;
    expect(left).toBeGreaterThanOrEqual(4);
    expect(left + 135).toBeLessThanOrEqual(width - 4);
  });

  it('is no element of its own when a parent carries the label, shows no bubble without one, and releases its pictures', () => {
    const s = render(<RoomView {...PROPS} accessible={false} accessibilityLabel={undefined} bubble={null} />);
    expect(s.getByTestId('room').props.accessible).toBe(false);
    expect(s.queryByTestId('room-bubble', { includeHiddenElements: true })).toBeNull();
    const all = pictures(s);
    s.unmount();
    for (const p of all) expect(p.dispose).toHaveBeenCalled();
  });
  it('draws the living room: a new plant stage rebuilds the static picture once, the same one records nothing (ruling 7)', () => {
    // Stage 2 gives the starter fern a live state ('g2'), so the key carries an effect state throughout.
    const living = () => ({ plantStage: 2 as const, petEnergy: 'wander' as const, awards: [] });
    const s = render(<RoomView {...PROPS} living={living()} />);
    const [back, , front] = pictures(s);
    let before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} living={living()} />); // a fresh, equal object
    act(() => { jest.advanceTimersByTime(LOOP_MS); }); // and a loop tick
    expect(picture.mock.calls.length - before).toBe(0);
    before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} living={{ ...living(), plantStage: 4 }} />);
    // A new static room: back and front, then KIP's three and the three loop frames (keyed on the room).
    expect(picture.mock.calls.length - before).toBe(8);
    const [back2, , front2] = pictures(s);
    expect([back2 !== back, front2 !== front]).toEqual([true, true]);
  });

  describe('the clock, the radio and the awards (ruling 7, PF3-CLOCK, T4-FIX)', () => {
    const at = (id: string, item: string, over: Partial<Placement>): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
    const CLOCK = at('p1', 'art.clock', { layer: 'wallR' });
    const LIVE = { ...starterLayout(), pieces: [...starterLayout().pieces, CLOCK, at('p2', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }), at('p3', 'shelf.awards', { layer: 'wallR', y: 12 })] };
    const AWARDS = { plantStage: 5 as const, petEnergy: 'wander' as const, awards: [5, 3] };
    const keysOf = (spy: jest.SpyInstance) => spy.mock.calls.map(([input]) => isoRoom.isoRoomKey(input));

    it('a running clock rebuilds the room once a minute and never on a loop tick (ruling 7)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
      const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, CLOCK] };
      const s = render(<RoomView {...PROPS} layout={layout} />);
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
      expect(picture.mock.calls.length - before).toBe(0);
      act(() => { jest.advanceTimersByTime(30_000); });
      // 07:13: one new static room (back and front), then KIP's three and the three loop frames keyed on it.
      expect(picture.mock.calls.length - before).toBe(8);
      const after = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
      expect(picture.mock.calls.length - after).toBe(0);
      s.unmount();
    });

    it('a running clock, radio and shelf of awards record 0 pictures a tick, and exactly one rebuild on the minute', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
      // The radio's notes are in the loop frames (T5-FIX M2); the starter room has none of that colour.
      const frames = jest.spyOn(isoRoom, 'drawIsoFramesEach');
      const noteIn = () => (frames.mock.results.at(-1)!.value as RoomRect[][]).some((f) => f.some(([, , , , c]) => c === '#FDE68A'));
      render(<RoomView {...PROPS} />).unmount();
      expect(noteIn()).toBe(false);
      const spy = jest.spyOn(isoRoom, 'drawIsoStatic');
      const s = render(<RoomView {...PROPS} layout={LIVE} living={AWARDS} />);
      expect(noteIn()).toBe(true);
      frames.mockRestore();
      expect(keysOf(spy)).toHaveLength(1);
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p1=live@07:12'));
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p2=notes'));
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p3=a53'));
      const seen = new Set([pictures(s)[3]]);
      const before = picture.mock.calls.length;
      for (let i = 0; i < 6; i++) {
        act(() => { jest.advanceTimersByTime(LOOP_MS); });
        seen.add(pictures(s)[3]);
      }
      expect(picture.mock.calls.length - before).toBe(0);
      expect(seen.size).toBeGreaterThan(1); // the loops (the radio's notes among them) do run
      act(() => { jest.advanceTimersByTime(30_000 - LOOP_MS * 6 + 100); });
      expect(picture.mock.calls.length - before).toBe(8);
      expect(keysOf(spy)).toHaveLength(2);
      expect(keysOf(spy)[1]).toEqual(expect.stringContaining('p1=live@07:13'));
      spy.mockRestore();
      s.unmount();
    });

    it('an unfocused page holds the minute: no rebuild and no clock timer; back in focus, one rebuild at once (PF3-CLOCK)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
      const s = render(<RoomView {...PROPS} layout={LIVE} living={AWARDS} />);
      mockFocused = false;
      s.rerender(<RoomView {...PROPS} layout={LIVE} living={{ ...AWARDS }} />);
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(31_000); });
      expect(picture.mock.calls.length - before).toBe(0);
      expect(jest.getTimerCount()).toBe(0); // the loops hold too
      mockFocused = true;
      s.rerender(<RoomView {...PROPS} layout={LIVE} living={{ ...AWARDS }} />);
      expect(picture.mock.calls.length - before).toBe(8);
      s.unmount();
    });

    it('a drag in progress holds the minute: no rebuild until it lets go (PF3-CLOCK)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
      const s = render(<RoomView {...PROPS} layout={LIVE} living={AWARDS} dragging />);
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(31_000); });
      expect(picture.mock.calls.length - before).toBe(0);
      s.rerender(<RoomView {...PROPS} layout={LIVE} living={AWARDS} dragging={false} />);
      expect(picture.mock.calls.length - before).toBe(8);
      s.unmount();
    });

    it.each([
      ['paused (the editor is open over it)', 'paused'],
      ['out of sight (scrolled under the collapsed header)', 'holdClock'],
    ] as const)('a room %s holds the minute: no rebuild and no timer; let go, exactly one rebuild (ruling T5-FIX)', (_label, prop) => {
      jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
      const s = render(<RoomView {...PROPS} layout={LIVE} living={AWARDS} {...{ [prop]: true }} />);
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(31_000); });
      expect(picture.mock.calls.length - before).toBe(0);
      if (prop === 'paused') expect(jest.getTimerCount()).toBe(0); // paused also holds the loops
      else expect(jest.getTimerCount()).toBe(1); // only the loop clock, no minute timer
      s.rerender(<RoomView {...PROPS} layout={LIVE} living={AWARDS} {...{ [prop]: false }} />);
      expect(picture.mock.calls.length - before).toBe(8);
      s.unmount();
    });
  });

  describe('the cat (spec §8.2, §8.3, ruling 10)', () => {
    const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
    const CAT_ROOM = { ...starterLayout(), pieces: [...starterLayout().pieces, at('p1', 'pet.tabby', 6, 6), at('p2', 'pet.bed', 5, 5)] };
    const PLAYFUL = { plantStage: 5 as const, petEnergy: 'play' as const, awards: [] };
    const keysOf = (spy: jest.SpyInstance) => spy.mock.calls.map(([input]) => isoRoom.isoRoomKey(input));
    const placedOf = (spy: jest.SpyInstance) => {
      const s = spy.mock.results.at(-1)!.value as ReturnType<typeof drawIsoStatic>;
      return [...s.behind, ...s.ahead].map((pp) => pp.p.id);
    };

    it('at 22:00 the playing cat curls up on its bed: exactly one rebuild, and none on a loop tick or a later minute', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 21, 59, 30));
      const spy = jest.spyOn(isoRoom, 'drawIsoStatic');
      const s = render(<RoomView {...PROPS} layout={CAT_ROOM} living={PLAYFUL} />);
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p1=play'));
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
      expect(picture.mock.calls.length - before).toBe(0);
      act(() => { jest.advanceTimersByTime(30_000); }); // 22:00
      expect(picture.mock.calls.length - before).toBe(8);
      expect(keysOf(spy)).toHaveLength(2);
      expect(keysOf(spy)[1]).toEqual(expect.stringContaining('p1=nap'));
      expect(keysOf(spy)[1]).toEqual(expect.stringContaining('p1>p2'));
      const placed = placedOf(spy);
      expect(placed[placed.indexOf('p2') + 1]).toBe('p1');
      // The cat's state does not change with the minute: 22:01 rebuilds nothing.
      const after = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(60_000 + LOOP_MS * 3); });
      expect(picture.mock.calls.length - after).toBe(0);
      expect(keysOf(spy)).toHaveLength(2);
      spy.mockRestore();
      s.unmount();
    });

    it('at night with Reduce Motion on, the cat is curled on its bed at frame 0, and a tick records 0 pictures (edge case 4)', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 23, 0, 30));
      const spy = jest.spyOn(isoRoom, 'drawIsoStatic');
      const s = render(<RoomView {...PROPS} night layout={CAT_ROOM} living={PLAYFUL} reduceMotion />);
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p1>p2'));
      const frame = pictures(s)[3];
      const before = picture.mock.calls.length;
      act(() => { jest.advanceTimersByTime(LOOP_MS * 6); });
      expect(picture.mock.calls.length - before).toBe(0);
      expect(pictures(s)[3]).toBe(frame);
      spy.mockRestore();
      s.unmount();
    });

    it('in the editor a napping cat stays curled on its own tile, so a tap or a drag finds it there', () => {
      jest.setSystemTime(new Date(2026, 9, 24, 23, 0, 30));
      const spy = jest.spyOn(isoRoom, 'drawIsoStatic');
      const s = render(<RoomView {...PROPS} night layout={CAT_ROOM} living={PLAYFUL} editing />);
      expect(keysOf(spy)[0]).toEqual(expect.stringContaining('p1=nap'));
      expect(keysOf(spy)[0]).not.toEqual(expect.stringContaining('p1>p2'));
      const s0 = spy.mock.results.at(-1)!.value as ReturnType<typeof drawIsoStatic>;
      const atOf = (id: string) => [...s0.behind, ...s0.ahead].find((pp) => pp.p.id === id)!;
      expect(atOf('p1').o.effect).toBe('nap');
      expect(atOf('p1').at).not.toEqual(atOf('p2').at);
      spy.mockRestore();
      s.unmount();
    });
  });

  it('draws a room with no living (PF3-LIVING) exactly as the neutral room: plants at full growth', () => {
    const spy = jest.spyOn(isoRoom, 'drawIsoStatic');
    render(<RoomView {...PROPS} />);
    const drawn = spy.mock.results[0]!.value as ReturnType<typeof drawIsoStatic>;
    spy.mockRestore();
    expect([drawn.back, drawn.front]).toEqual([STATIC.back, STATIC.front]);
  });
});
