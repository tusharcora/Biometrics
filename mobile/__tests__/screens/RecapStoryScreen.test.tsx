import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { AccessibilityInfo, StatusBar, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { withCharacter } from '../../jest-mocks/characterContext';
import type { Recap } from '../../src/api/recaps';
import { captureToPng, saveImage, shareImage } from '../../src/lib/recapCapture';
import { recapTint } from '../../src/lib/recapTheme';
import { STORY_FRAME_MS } from '../../src/lib/storyViewer';
import { RecapStoryScreen } from '../../src/screens/RecapStoryScreen';

jest.mock('expo-secure-store');
jest.mock('../../src/lib/recapCapture', () => ({ captureToPng: jest.fn(), saveImage: jest.fn(), shareImage: jest.fn() }));
let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});
const mockGoBack = jest.fn();
const mockRecap: Recap = {
  id: 'r-week', kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A steady week.', story: 'Five nights on goal and a calm Sunday.', personaId: 'luna',
  builtAt: '2026-10-05T09:00:00.000Z', openedAt: null, sleepGoalMinutes: 480, lineSource: 'ai', rebuiltAt: null,
  stats: { nightsWithData: 6, avgSleepMinutes: 455, nightsOnGoal: 5, longestOnGoalStreak: 3, bedtimeSpreadMinutes: 42, bestNight: { date: '2026-09-29', minutesAsleep: 485 }, weekStrip: [] },
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, canGoBack: () => true }),
  useRoute: () => ({ params: { recap: mockRecap } }),
}));

const URI = 'file:///cache/recap-1.png';
let store: Record<string, string>;
const eyebrow = () => screen.getByTestId('story-eyebrow');
const tap = (x: number) => fireEvent.press(screen.getByTestId('story-viewer-tap'), { nativeEvent: { locationX: x } });

async function open() {
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      {withCharacter(<RecapStoryScreen />)}
    </SafeAreaProvider>,
  );
  // The stored include choices load first; Share and Save wait for them.
  await act(async () => {});
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockReduceMotion = false;
  store = {};
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((k: string) => Promise.resolve(store[k] ?? null));
  (captureToPng as jest.Mock).mockResolvedValue(URI);
  (saveImage as jest.Mock).mockResolvedValue('saved');
  (shareImage as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('opens on frame 1 and moves on by itself every five seconds, closing after the last frame', async () => {
  await open();
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  // The frame's own bar is hidden; the viewer draws its animated one over it.
  expect(screen.getByTestId('story-progress-slot')).toHaveStyle({ opacity: 0 });
  expect(screen.getByTestId('story-viewer-progress')).toBeTruthy();
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 3 OF 3');
  expect(mockGoBack).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('a tap on the right half goes forward, on the left half back', async () => {
  await open();
  tap(10000);
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
  tap(0);
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  tap(10000);
  tap(10000);
  tap(10000);
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('pauses while pressed and held', async () => {
  await open();
  fireEvent(screen.getByTestId('story-viewer-tap'), 'pressIn');
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 3));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  fireEvent(screen.getByTestId('story-viewer-tap'), 'pressOut');
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
});

it('with reduce motion on, stays on a frame until tapped', async () => {
  mockReduceMotion = true;
  await open();
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 3));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  tap(10000);
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
});

it('closes on a swipe down, and springs back on a short drag', async () => {
  await open();
  act(() => fireGestureHandler(getByGestureTestId('story-viewer-swipe'), [{ state: State.BEGAN }, { state: State.ACTIVE, translationY: 30 }, { state: State.END, translationY: 30, velocityY: 50 }]));
  act(() => jest.advanceTimersByTime(1));
  expect(mockGoBack).not.toHaveBeenCalled();
  act(() => fireGestureHandler(getByGestureTestId('story-viewer-swipe'), [{ state: State.BEGAN }, { state: State.ACTIVE, translationY: 200 }, { state: State.END, translationY: 200, velocityY: 1200 }]));
  // runOnJS hands the close to the JS thread on the next tick.
  act(() => jest.advanceTimersByTime(1));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('closes from the close button', async () => {
  await open();
  fireEvent.press(screen.getByTestId('story-viewer-close'));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('shares the frame on screen, from the off-screen 1080-wide export, paused while it runs', async () => {
  await open();
  tap(10000);
  tap(10000);
  expect(screen.getByTestId('story-export-eyebrow')).toHaveTextContent('MY WEEK · 3 OF 3');
  // The exported frame draws its own full bar.
  expect(screen.getByTestId('story-export-progress-slot')).toHaveStyle({ opacity: 1 });
  let finish!: () => void;
  (shareImage as jest.Mock).mockImplementation(() => new Promise<void>((r) => (finish = r)));
  await act(async () => fireEvent.press(screen.getByTestId('story-viewer-share')));
  expect(captureToPng).toHaveBeenCalledTimes(1);
  expect(shareImage).toHaveBeenCalledWith(URI);
  // The share sheet is up: the story does not run out underneath it.
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 2));
  expect(mockGoBack).not.toHaveBeenCalled();
  await act(async () => finish());
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('saves the frame on screen and says so', async () => {
  await open();
  tap(10000);
  await act(async () => fireEvent.press(screen.getByTestId('story-viewer-save')));
  expect(captureToPng).toHaveBeenCalledTimes(1);
  expect(saveImage).toHaveBeenCalledWith(URI);
  expect(screen.getByTestId('story-viewer-notice')).toHaveTextContent('Saved to Photos.');
});

it("follows the builder's stored include choices", async () => {
  store['recapInclude.story'] = JSON.stringify({ bestNight: false });
  await open();
  tap(10000);
  expect(screen.queryByTestId('story-best')).toBeNull();
  expect(screen.queryByTestId('story-export-best')).toBeNull();
});

it('draws light status bar content and dark-ground buttons on the coach ground, whatever the app theme', async () => {
  await open();
  const bars = screen.UNSAFE_getAllByType(StatusBar);
  expect(bars[bars.length - 1]!.props.barStyle).toBe('light-content');
  const t = recapTint('luna');
  expect(StyleSheet.flatten(screen.getByTestId('story-viewer-share').props.style)).toMatchObject({ backgroundColor: t.text });
  expect(screen.getByTestId('story-viewer-share-label')).toHaveStyle({ color: t.ground });
  expect(StyleSheet.flatten(screen.getByTestId('story-viewer-save').props.style)).toMatchObject({ backgroundColor: t.surface, borderColor: t.border });
  expect(screen.getByTestId('story-viewer-save-label')).toHaveStyle({ color: t.text });
});

it('draws no frame until the stored include choices have loaded, then starts from frame 1', async () => {
  let finish!: (v: string | null) => void;
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(() => new Promise((r) => (finish = r)));
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      {withCharacter(<RecapStoryScreen />)}
    </SafeAreaProvider>,
  );
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 2));
  expect(screen.queryByTestId('story')).toBeNull();
  expect(screen.queryByTestId('story-export')).toBeNull();
  await act(async () => finish(JSON.stringify({ bestNight: false })));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  tap(10000);
  expect(screen.queryByTestId('story-best')).toBeNull();
});

it('stays on a frame while a screen reader is on, still stepping by tap', async () => {
  (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
  await open();
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 3));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  tap(10000);
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
});

it('pauses when a screen reader is turned on mid-story and runs again when it is off', async () => {
  const listeners: Array<(on: boolean) => void> = [];
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, fn: (on: boolean) => void) => {
    if (event === 'screenReaderChanged') listeners.push(fn);
    return { remove: jest.fn() };
  }) as never);
  await open();
  act(() => listeners.forEach((fn) => fn(true)));
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS * 3));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 1 OF 3');
  act(() => listeners.forEach((fn) => fn(false)));
  act(() => jest.advanceTimersByTime(STORY_FRAME_MS));
  expect(eyebrow()).toHaveTextContent('MY WEEK · 2 OF 3');
});
