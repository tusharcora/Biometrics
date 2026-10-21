// A room drawn for someone else's eyes (spec 2026-10-15 §10.1; P4 ruling 24, PF4-F7), over the real RoomView.
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { NeutralRoom } from '../../src/components/room/NeutralRoom';
import { LOOP_MS, RoomView } from '../../src/components/room/RoomView';
import { PAN_START_PT, clampAxis } from '../../src/lib/room/iso/crop';
import { isoGrid } from '../../src/lib/room/iso/grid';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { STEP_MS } from '../../src/lib/room/live/walk';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';

jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => true }));
let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});

const picture = createPicture as jest.Mock;
const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
const CAT_ROOM = { ...starterLayout(), pieces: [...starterLayout().pieces, at('p1', 'pet.tabby', 5, 3)] };
const room = (over: Partial<React.ComponentProps<typeof NeutralRoom>> = {}) => (
  <NeutralRoom layout={CAT_ROOM} tier={1} colour="lime" worn={EMPTY_WORN} pose="wave" bubble="HI THERE!" width={300} height={240} label="Maya's room" testID="visit-room" {...over} />
);
const view = () => screen.UNSAFE_getByType(RoomView).props;
const transforms = () => JSON.stringify(screen.getAllByTestId('skia-group', { includeHiddenElements: true }).map((g) => g.props.skiaTransform));

beforeEach(() => { picture.mockClear(); jest.useFakeTimers(); mockReduceMotion = false; });
afterEach(() => jest.useRealTimers());

it('draws neutral: no living, the fallback sky, night by this device\'s clock, the cat live, KIP never walking (ruling 24, PF4-F7)', () => {
  jest.setSystemTime(new Date(2026, 9, 26, 21, 30));
  render(room());
  expect(view()).toMatchObject({ weather: 'fallback', night: true, live: true, screen: 'lines', mood: 'idle', pose: 'wave', bubble: 'HI THERE!' });
  expect(view().living).toBeUndefined();
  expect(view().kipWalks).toBeFalsy();
  expect(view().pieceActions).toBeUndefined();
  expect(view().onPieceAction).toBeUndefined();
  expect(view().editing).toBeFalsy();
  screen.unmount();
  jest.setSystemTime(new Date(2026, 9, 26, 10, 0));
  render(room());
  expect(view().night).toBe(false);
});

it('the visited room\'s cat wanders, and its steps and the loop ticks record no picture (PF4-F7: exactly 0 a tick)', () => {
  jest.setSystemTime(new Date(2026, 9, 26, 10, 0));
  render(room());
  const before = picture.mock.calls.length;
  const was = transforms();
  act(() => { jest.advanceTimersByTime(STEP_MS * 4); });
  expect(transforms()).not.toEqual(was); // the cat moved
  expect(picture.mock.calls.length - before).toBe(0);
  act(() => { jest.advanceTimersByTime(LOOP_MS * 6); });
  expect(picture.mock.calls.length - before).toBe(0);
});

it('holds the cat and the loops still under Reduce Motion', () => {
  jest.setSystemTime(new Date(2026, 9, 26, 10, 0));
  mockReduceMotion = true;
  render(room());
  const was = transforms();
  const before = picture.mock.calls.length;
  act(() => { jest.advanceTimersByTime(STEP_MS * 4); });
  expect(transforms()).toEqual(was);
  expect(picture.mock.calls.length - before).toBe(0);
});

it('one finger pans a pannable room inside its edges, and never a fixed one (spec §10.1 "Pan works")', () => {
  jest.setSystemTime(new Date(2026, 9, 26, 10, 0));
  render(room({ tier: 3, pannable: true }));
  const g = isoGrid(3);
  const start = view().offset as { x: number; y: number };
  act(() => fireGestureHandler(getByGestureTestId('visit-room-pan'), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: -1, translationY: -1 },
    { state: State.ACTIVE, translationX: -5000, translationY: -5000 },
    { state: State.END, translationX: -5000, translationY: -5000 },
  ]));
  expect(view().offset).toEqual({ x: clampAxis(-1e6, 300, g.W * 2), y: clampAxis(-1e6, 240, g.H * 2) });
  expect(view().offset.x).toBe(300 - g.W * 2);
  expect(view().offset).not.toEqual(start);
  screen.unmount();
  render(room({ tier: 3 }));
  const fixed = view().offset;
  act(() => fireGestureHandler(getByGestureTestId('visit-room-pan'), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: -1, translationY: -1 },
    { state: State.ACTIVE, translationX: -5000, translationY: -5000 },
    { state: State.END, translationX: -5000, translationY: -5000 },
  ]));
  expect(view().offset).toEqual(fixed);
});

it('is one image with one label', () => {
  render(room());
  const img = screen.getByTestId('visit-room');
  expect(img.props.accessibilityLabel).toBe("Maya's room");
  expect(img.props.accessibilityActions).toBeUndefined();
});

it('pans only past the editor\'s threshold, and only a room bigger than the view (T9-FIX)', () => {
  const config = () => (getByGestureTestId('visit-room-pan') as unknown as { config: { minDist?: number; enabled?: boolean } }).config;
  render(room({ tier: 3, pannable: true }));
  expect([config().minDist, config().enabled]).toEqual([PAN_START_PT, true]);
  expect(PAN_START_PT).toBe(8);
  screen.unmount();
  // A view wider and taller than the room: nothing to pan, so every touch stays with the page.
  render(room({ tier: 3, pannable: true, width: 2000, height: 2000 }));
  expect(config().enabled).toBe(false);
  const fits = view().offset;
  act(() => fireGestureHandler(getByGestureTestId('visit-room-pan'), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: -1, translationY: -1 },
    { state: State.ACTIVE, translationX: -500, translationY: -500 },
    { state: State.END, translationX: -500, translationY: -500 },
  ]));
  expect(view().offset).toEqual(fits);
  screen.unmount();
  render(room({ tier: 3 }));
  expect(config().enabled).toBe(false);
});

