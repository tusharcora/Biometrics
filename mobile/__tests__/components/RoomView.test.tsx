import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { bubbleAnchor, LOOP_MS, RoomView, type RoomViewProps } from '../../src/components/room/RoomView';
import { roomCrop } from '../../src/components/room/roomCrop';
import { FOCUS_BOX, ROOM_W, THUMB_BOX } from '../../src/lib/room/grid';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';
import { SEATS } from '../../src/lib/room/draw';
import { registerItems } from '../../src/lib/room/items';

let mockFocused = true;
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => mockFocused }));

const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  loadout: STARTER_LOADOUT, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'type', mood: 'glance', screen: 'dots', crop: { width: 323, height: 200 }, cellPt: 2,
  bubble: 'ON IT…', reduceMotion: false, accessibilityLabel: 'KIP at the desk, typing. Window: cloudy', testID: 'room',
};
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true }).map((p) => p.props.picture);

beforeEach(() => {
  mockFocused = true;
  picture.mockClear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('roomCrop', () => {
  it.each([280, 323, 335, 375])('keeps the whole focus box on screen at an inner width of %i points, centred', (width) => {
    const { x, y } = roomCrop({ width, height: 200, cellPt: 2, box: FOCUS_BOX });
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    expect(x + FOCUS_BOX.x * 2).toBeGreaterThanOrEqual(0);
    expect(x + (FOCUS_BOX.x + FOCUS_BOX.w) * 2).toBeLessThanOrEqual(width);
    expect(y + FOCUS_BOX.y * 2).toBe(0);
    expect(y + (FOCUS_BOX.y + FOCUS_BOX.h) * 2).toBe(200);
    if (width <= ROOM_W * 2) {
      // Extra width shows more room, never a gap at either edge.
      expect(x).toBeLessThanOrEqual(0);
      expect(x + ROOM_W * 2).toBeGreaterThanOrEqual(width);
    } else {
      // Wider than the whole room (340 points): the room is centred, never scaled.
      expect(x).toBe(Math.round((width - ROOM_W * 2) / 2));
    }
  });

  it('crops 280 points to exactly the focus box (a 320-point phone)', () => {
    expect(roomCrop({ width: 280, height: 200, cellPt: 2, box: FOCUS_BOX })).toEqual({ x: -30, y: -20 });
  });

  it('crops the thumbnail to THUMB_BOX at 1 point a cell', () => {
    expect(roomCrop({ width: 96, height: 60, cellPt: 1, box: THUMB_BOX })).toEqual({ x: -70, y: -40 });
  });
});

describe('RoomView', () => {
  it('draws back, KIP, front and the loop frame, moved by the crop', () => {
    const s = render(<RoomView {...PROPS} />);
    expect(pictures(s)).toHaveLength(4);
    expect(s.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: -8 }, { translateY: -20 }]);
    expect(s.getByTestId('skia-canvas', { includeHiddenElements: true }).props.style).toEqual({ width: 323, height: 200 });
  });

  it('draws the thumbnail at 1 point a cell, cropped to the thumbnail box', () => {
    const s = render(<RoomView {...PROPS} cellPt={1} box="thumb" crop={{ width: 96, height: 60 }} bubble={null} />);
    expect(s.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: -70 }, { translateY: -40 }]);
  });

  it('does not rebuild the room picture on a pose change: only KIP is redrawn', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pose="point" mood="glance" />);
    const [back2, , front2] = pictures(s);
    expect([back2, front2]).toEqual([back, front]);
    expect(picture.mock.calls.length - before).toBe(1);
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
    ['while paused (decorate mode is open)', { paused: true }, true],
  ] as const)('holds the first frame %s', (_label, extra, focused) => {
    mockFocused = focused;
    const s = render(<RoomView {...PROPS} {...extra} />);
    const [, kip, , frame] = pictures(s);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 4); });
    expect([pictures(s)[1], pictures(s)[3]]).toEqual([kip, frame]);
  });

  it('re-records KIP when a desk swap moves the seat, even with the same pose', () => {
    registerItems([{ id: 'test.lowTable', slot: 'desk', style: 'low', draw: () => ({ base: [] }) }]);
    const s = render(<RoomView {...PROPS} />);
    const [, kip] = pictures(s);
    s.rerender(<RoomView {...PROPS} loadout={{ ...STARTER_LOADOUT, desk: 'test.lowTable' }} />);
    expect(pictures(s)[1]).not.toBe(kip);
  });

  it('is one image with one label; the bubble is decorative', () => {
    const s = render(<RoomView {...PROPS} />);
    const room = s.getByTestId('room');
    expect(room.props.accessibilityRole).toBe('image');
    expect(room.props.accessibilityLabel).toBe('KIP at the desk, typing. Window: cloudy');
    const bubble = s.getByTestId('room-bubble', { includeHiddenElements: true });
    expect(bubble.props.accessibilityElementsHidden).toBe(true);
    expect(bubble).toHaveTextContent('ON IT…');
  });

  it('is no element of its own when a parent carries the label (accessible={false})', () => {
    const s = render(<RoomView {...PROPS} accessible={false} accessibilityLabel={undefined} />);
    const room = s.getByTestId('room');
    expect(room.props.accessible).toBe(false);
    expect(room.props.accessibilityRole).toBeUndefined();
  });

  it('shows no bubble when there is none', () => {
    const s = render(<RoomView {...PROPS} bubble={null} />);
    expect(s.queryByTestId('room-bubble', { includeHiddenElements: true })).toBeNull();
  });

  it.each([280, 323])('keeps a measured bubble inside the %i-point crop, 4 points from either edge', (width) => {
    const s = render(<RoomView {...PROPS} bubble="HERE'S MY TAKE" crop={{ width, height: 200 }} />);
    const bubble = () => s.getByTestId('room-bubble', { includeHiddenElements: true });
    const measure = (w: number) => act(() => { fireEvent(bubble(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: w, height: 20 } } }); });
    measure(135);
    const { left } = bubble().props.style;
    expect(left).toBeGreaterThanOrEqual(4);
    expect(left + 135).toBeLessThanOrEqual(width - 4);
    // A bubble that fits stays over KIP's head.
    measure(40);
    const offset = roomCrop({ width, height: 200, cellPt: 2, box: FOCUS_BOX });
    expect(bubble().props.style.left).toBe(Math.max(4, offset.x + bubbleAnchor(SEATS.standard).x * 2 - 36));
  });

  it('caps the decorative bubble text\'s font scale', () => {
    const s = render(<RoomView {...PROPS} />);
    expect(s.getByText('ON IT…', { includeHiddenElements: true }).props.maxFontSizeMultiplier).toBeGreaterThan(0);
  });

  it('anchors the bubble above KIP\'s head', () => {
    expect(bubbleAnchor(SEATS.standard)).toEqual({ x: SEATS.standard.x + 16, y: SEATS.standard.y + 10 });
  });

  it('releases its pictures on unmount', () => {
    const s = render(<RoomView {...PROPS} />);
    const all = pictures(s);
    s.unmount();
    for (const p of all) expect(p.dispose).toHaveBeenCalled();
  });
});
