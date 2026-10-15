import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { bubbleAnchor, LOOP_MS, RoomView, type RoomViewProps } from '../../src/components/room/RoomView';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';
import { isoCrop } from '../../src/lib/room/iso/crop';
import { drawIsoStatic } from '../../src/lib/room/iso/room';

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

  it('a pose change keeps the room\'s pictures: KIP and the shown frame (clipped by KIP) are re-recorded', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pose="point" mood="glance" />);
    const [back2, , front2] = pictures(s);
    expect([back2, front2]).toEqual([back, front]);
    // Only the current frame's picture is recorded, keyed on KIP's silhouette (ruling T10 framePictures).
    expect(picture.mock.calls.length - before).toBe(2);
  });

  it('a loop tick records only KIP and that frame, never the room (spec §3.7)', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    const before = picture.mock.calls.length;
    act(() => { jest.advanceTimersByTime(LOOP_MS); });
    expect([pictures(s)[0], pictures(s)[2]]).toEqual([back, front]);
    expect(picture.mock.calls.length - before).toBe(2);
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
});
