import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { RoomView, type RoomViewProps } from '../../src/components/room/RoomView';
import * as isoRoom from '../../src/lib/room/iso/room';
import { STEP_MS, TRIP_MIN_MS } from '../../src/lib/room/live/walk';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';

let mockFocused = true;
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => mockFocused }));

// KIP walking between answers in the room card (spec 2026-10-15 §9.2, rulings 9, 13): the view's own walk, its
// holds, and what a step costs (0 pictures).
const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'rest', mood: 'curious', screen: 'lines', crop: { width: 323, height: 240 }, cellPt: 2, bubble: null, reduceMotion: false,
  testID: 'room', accessibilityLabel: 'KIP in its room, resting. Window: cloudy', kipWalks: true, idle: true,
};
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true });
const invertClipped = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-group', { includeHiddenElements: true }).some((g) => g.props.skiaInvertClip);
/** KIP is off its seat: runs mode, with the inverted clip of its outline over the loops. */
const walking = (s: ReturnType<typeof render>) => invertClipped(s);
const tick = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
// Step by step, one act per loop frame, so every step is drawn.
const untilWalking = (s: ReturnType<typeof render>) => { for (let i = 0; i < 200 && !walking(s); i++) tick(STEP_MS); };
const untilSeated = (s: ReturnType<typeof render>) => { for (let i = 0; i < 200 && walking(s); i++) tick(STEP_MS); };

let random: jest.SpyInstance;
beforeEach(() => {
  mockFocused = true;
  picture.mockClear();
  jest.useFakeTimers();
  random = jest.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => { random.mockRestore(); jest.useRealTimers(); });

describe('KIP walks in the room card (spec §9.2, ruling 13)', () => {
  it('sits 20 s, walks to the fern recording nothing per step, waters it, walks back and sits', () => {
    const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const s = render(<RoomView {...PROPS} />);
    expect(pictures(s)).toHaveLength(4); // P1's static pictures: KIP at its desk
    tick(TRIP_MIN_MS);
    expect(walking(s)).toBe(true);
    // The first step leaves the seat: KIP's walking pose and the room's runs are recorded once. Every step after it
    // records nothing (Global Constraints: a walk step records 0 pictures).
    tick(STEP_MS);
    const before = picture.mock.calls.length;
    const transforms = new Set<string>();
    for (let i = 0; i < 3; i++) {
      tick(STEP_MS);
      transforms.add(JSON.stringify(s.getAllByTestId('skia-group', { includeHiddenElements: true }).map((g) => g.props.skiaTransform)));
    }
    expect(picture.mock.calls.length - before).toBe(0);
    expect(transforms.size).toBe(3); // it moved each step
    // The rest of the trip records only KIP's pose changes, three frames each: walking the other way at the turn
    // by the fern, and the water pose there. Back at its desk, KIP and the room are the cached pictures it left.
    untilSeated(s);
    expect(walking(s)).toBe(false);
    expect(pictures(s)).toHaveLength(4);
    expect(picture.mock.calls.length - before).toBe(6);
    // Screen readers: the room stays one image with one label, and nothing is announced.
    expect(s.getByTestId('room').props.accessibilityLabel).toBe(PROPS.accessibilityLabel);
    expect(say).not.toHaveBeenCalled();
    say.mockRestore();
  });

  it('takes turns between two targets, and a trip it has made before records nothing: every pose and the room are cached', () => {
    const s = render(<RoomView {...PROPS} layout={{ ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.floorlamp', layer: 'floor', x: 5, y: 2, facing: 'L', mirror: false }] }} />);
    const seen: string[] = [];
    const recorded: number[] = [];
    const draw = jest.spyOn(isoRoom, 'drawKipLayer');
    for (let k = 0; k < 3; k++) {
      const before = picture.mock.calls.length;
      draw.mockClear();
      untilWalking(s);
      untilSeated(s);
      seen.push([...new Set(draw.mock.calls.map(([kip]) => kip.pose))].filter((p) => p !== 'rest').join());
      recorded.push(picture.mock.calls.length - before);
    }
    draw.mockRestore();
    expect(seen).toEqual(['point', 'water', 'point']); // the lamp, the fern, the lamp again: never one twice in a row
    expect(recorded[2]).toBe(0);
  });

  it.each([
    ['the editor opens (paused)', { paused: true }],
    ['Reduce Motion turns on', { reduceMotion: true }],
    ['a bubble shows', { bubble: '+25!' }],
    ['the page stops letting it walk (a turn, the prompt focused)', { kipWalks: false }],
  ] as const)('is back on its seat in the same render when %s, and never sets off while held', (_name, hold) => {
    const s = render(<RoomView {...PROPS} />);
    tick(TRIP_MIN_MS + STEP_MS * 3);
    expect(walking(s)).toBe(true);
    s.rerender(<RoomView {...PROPS} {...hold} />);
    expect(walking(s)).toBe(false);
    expect(pictures(s)).toHaveLength(4);
    tick(TRIP_MIN_MS * 3);
    expect(walking(s)).toBe(false);
  });

  it('is back on its seat in the same render when the page loses focus, and never sets off unfocused', () => {
    const s = render(<RoomView {...PROPS} />);
    tick(TRIP_MIN_MS + STEP_MS * 3);
    expect(walking(s)).toBe(true);
    mockFocused = false;
    s.rerender(<RoomView {...PROPS} />);
    expect(walking(s)).toBe(false);
    tick(TRIP_MIN_MS * 3);
    expect(walking(s)).toBe(false);
  });

  it('only walks to what the crop shows: a crop with nothing but the desk keeps KIP seated', () => {
    const s = render(<RoomView {...PROPS} crop={{ width: 40, height: 40 }} />);
    tick(TRIP_MIN_MS * 3);
    expect(walking(s)).toBe(false);
  });
});

describe('the plant smile frame (ruling 9)', () => {
  it('in the idle stage with a plant, loop frame 2 draws KIP curious; otherwise never', () => {
    const draw = jest.spyOn(isoRoom, 'drawKipLayer');
    const moods = () => draw.mock.calls.map(([k]) => `${k.frame}:${k.mood}`);
    render(<RoomView {...PROPS} mood="idle" kipWalks={false} />);
    expect(moods()).toEqual(['0:idle', '1:idle', '2:curious']);
    draw.mockClear();
    render(<RoomView {...PROPS} mood="idle" kipWalks={false} idle={false} />);
    expect(moods()).toEqual(['0:idle', '1:idle', '2:idle']);
    draw.mockClear();
    const bare = { ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id !== 'plant') };
    render(<RoomView {...PROPS} layout={bare} mood="idle" kipWalks={false} />);
    expect(moods()).toEqual(['0:idle', '1:idle', '2:idle']);
    draw.mockRestore();
  });
});
