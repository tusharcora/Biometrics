import { mockNav, openChat, status } from '../../jest-mocks/coachScreenHarness';
import React from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { fetchCoachStatus } from '../../src/api/coach';
import { CoachScreen } from '../../src/screens/CoachScreen';

// The mocks (api, navigation, RoomView, the room's score and sleep reads) live in jest-mocks/coachScreenHarness.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('../../src/lib/kipRoomPrefs', () => ({ readKipRoomShrunk: jest.fn(), writeKipRoomShrunk: jest.fn() }));
let mockReduceMotion = false;
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(mockReduceMotion));
// The page's Reduce Motion listener, so a test can switch it on mid-fade.
let reduceMotionChanged: ((on: boolean) => void) | null = null;
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, cb: (on: boolean) => void) => {
  if (event === 'reduceMotionChanged') reduceMotionChanged = cb;
  return { remove: jest.fn() };
}) as unknown as typeof AccessibilityInfo.addEventListener);

const prefs = jest.requireMock('../../src/lib/kipRoomPrefs');
const actualPrefs = jest.requireActual('../../src/lib/kipRoomPrefs');
const store = SecureStore as jest.Mocked<typeof SecureStore>;
// The fade is a Reanimated shared value: a change to it reaches the style on the next animation frame.
const scrollTo = async (s: ReturnType<typeof render>, y: number) => {
  fireEvent.scroll(s.getByTestId('coach-scroll'), { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 375, height: 2000 }, layoutMeasurement: { width: 375, height: 700 } } });
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
};
// The measured layouts: the card's bottom edge in the scroll content is 12 + 300 = 312; the expanded header above
// the scroll is `headerHeight` tall (60 unless a test says otherwise).
const layOut = (s: ReturnType<typeof render>, headerHeight = 60) => {
  fireEvent(s.getByTestId('kip-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: headerHeight } } });
  fireEvent(s.getByTestId('kip-room-card'), 'layout', { nativeEvent: { layout: { x: 20, y: 12, width: 335, height: 300 } } });
};
const overlay = (s: ReturnType<typeof render>) => s.getByTestId('kip-collapsed-header', { includeHiddenElements: true });

beforeEach(() => {
  mockReduceMotion = false;
  reduceMotionChanged = null;
  prefs.readKipRoomShrunk.mockResolvedValue(false);
  prefs.writeKipRoomShrunk.mockResolvedValue(undefined);
  store.getItemAsync.mockResolvedValue(null);
  store.setItemAsync.mockResolvedValue(undefined);
});

// The collapsed row (72) pins over the 60-point expanded header, so it reaches 12 points down over the scroll: the
// card's bottom edge (312) is under it at scroll 300, and the fade runs over the 24 points before, from 276.
it('collapse: the header fades in over the last 24 points before the card\'s bottom edge passes under it', async () => {
  const s = await openChat();
  layOut(s);
  await scrollTo(s, 276);
  expect(s.queryByTestId('kip-collapsed-header', { includeHiddenElements: true })).toBeNull();
  await scrollTo(s, 288);
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 0.5 });
  // While fading it is a picture only: taps and the screen reader reach the expanded header under it.
  expect(overlay(s).props.pointerEvents).toBe('none');
  expect(s.queryByTestId('kip-collapsed-header')).toBeNull();
  expect(s.getAllByRole('header', { name: 'KIP' })).toHaveLength(1);
  expect(s.getByTestId('coach-conversations-button')).toBeTruthy();
  await scrollTo(s, 300);
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 1 });
  expect(overlay(s).props.pointerEvents).toBe('auto');
  expect(s.getByTestId('kip-collapsed-status')).toHaveTextContent('In the pocket room');
  await scrollTo(s, 100);
  expect(s.queryByTestId('kip-collapsed-header', { includeHiddenElements: true })).toBeNull();
});

it('pins the threshold to the card\'s bottom edge from the measured layouts', async () => {
  // A taller expanded header (large text): the row reaches 72 - 64 = 8 points over the scroll, so the card's bottom
  // edge (312) reaches the row's bottom (72 on screen) at scroll 304: 64 + 312 - 304 = 72.
  const s = await openChat();
  layOut(s, 64);
  await scrollTo(s, 303);
  expect(overlay(s).props.pointerEvents).toBe('none');
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 23 / 24 });
  await scrollTo(s, 304);
  expect(overlay(s).props.pointerEvents).toBe('auto');
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 1 });
});

it('large text: an expanded header taller than the row is fully covered, and the threshold uses the same height', async () => {
  // A 90-point expanded header: the overlay grows to 90 (filled with the background), so nothing of the expanded
  // header shows below it, and it reaches 0 points over the scroll: the card's bottom edge (312) is under it at 312.
  const s = await openChat();
  layOut(s, 90);
  await scrollTo(s, 311);
  expect(overlay(s).props.pointerEvents).toBe('none');
  await scrollTo(s, 312);
  expect(overlay(s).props.pointerEvents).toBe('auto');
  expect(StyleSheet.flatten(overlay(s).props.style)).toMatchObject({ minHeight: 90 });
  expect(overlay(s).props.className).toContain('bg-background');
  // The pinned layer is as tall as the overlay and takes no room of its own over the scroll.
  expect(StyleSheet.flatten(s.getByTestId('kip-header-layer').props.style)).toMatchObject({ minHeight: 90, marginBottom: 0 });
});

it('Android: the pinned layer holds the whole overlay, so its lower strip takes taps', async () => {
  // Android delivers no touch outside a parent's bounds: the 72-point overlay must not hang below a 60-point layer.
  // The layer grows to 72 and gives the 12 points back with a negative margin, so the scroll does not move, and
  // lets touches through where it is empty.
  const s = await openChat();
  layOut(s);
  const layer = s.getByTestId('kip-header-layer');
  expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ minHeight: 72, marginBottom: -12 });
  expect(layer.props.pointerEvents).toBe('box-none');
  await scrollTo(s, 300);
  expect(StyleSheet.flatten(overlay(s).props.style)).toMatchObject({ minHeight: 72 });
});

it('fully in, screen readers get one KIP header and one set of header buttons', async () => {
  const s = await openChat();
  layOut(s);
  await scrollTo(s, 400);
  expect(s.getAllByRole('header', { name: 'KIP' })).toHaveLength(1);
  expect(s.getByTestId('kip-collapsed-header')).toBeTruthy();
  expect(s.queryByTestId('coach-conversations-button')).toBeNull();
  expect(s.getByTestId('kip-collapsed-conversations')).toBeTruthy();
  expect(s.getByTestId('kip-header', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
});

it('under Reduce Motion the collapsed header switches at the threshold, with no fade', async () => {
  mockReduceMotion = true;
  const s = await openChat();
  layOut(s);
  await scrollTo(s, 299);
  expect(s.queryByTestId('kip-collapsed-header', { includeHiddenElements: true })).toBeNull();
  await scrollTo(s, 300);
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 1 });
});

it('Reduce Motion switched on mid-fade drops the half-faded header at once; the threshold still switches it', async () => {
  const s = await openChat();
  layOut(s);
  await scrollTo(s, 288);
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 0.5 });
  await act(async () => reduceMotionChanged?.(true));
  expect(s.queryByTestId('kip-collapsed-header', { includeHiddenElements: true })).toBeNull();
  await scrollTo(s, 300);
  expect(overlay(s)).toHaveAnimatedStyle({ opacity: 1 });
});

it('the thumbnail scrolls back to the top', async () => {
  const s = await openChat();
  layOut(s);
  await scrollTo(s, 400);
  const spy = jest.spyOn(ScrollView.prototype as unknown as { scrollTo: (o: object) => void }, 'scrollTo');
  fireEvent.press(s.getByTestId('kip-room-thumbnail'));
  expect(spy).toHaveBeenCalledWith({ y: 0, animated: true });
  expect(s.getByTestId('kip-room-thumbnail').props.accessibilityLabel).toBe("Expand KIP's room");
  spy.mockRestore();
});

it('"Shrink room" collapses for good, persists, and survives a remount', async () => {
  const s = await openChat();
  fireEvent.press(s.getByTestId('kip-shrink-room'));
  expect(prefs.writeKipRoomShrunk).toHaveBeenCalledWith(true);
  expect(s.queryByTestId('kip-room-card')).toBeNull();
  expect(s.getByTestId('kip-collapsed-header')).toBeTruthy();
  expect(s.getAllByRole('header', { name: 'KIP' })).toHaveLength(1);
  s.unmount();
  prefs.readKipRoomShrunk.mockResolvedValue(true);
  const again = await openChat();
  await waitFor(() => expect(again.queryByTestId('kip-room-card')).toBeNull());
  fireEvent.press(again.getByTestId('kip-room-thumbnail'));
  expect(prefs.writeKipRoomShrunk).toHaveBeenLastCalledWith(false);
  expect(again.getByTestId('kip-room-card')).toBeTruthy();
});

it('a keychain failure leaves the card expanded, and "Shrink room" still works for the session', async () => {
  prefs.readKipRoomShrunk.mockImplementation(actualPrefs.readKipRoomShrunk);
  prefs.writeKipRoomShrunk.mockImplementation(actualPrefs.writeKipRoomShrunk);
  store.getItemAsync.mockRejectedValue(new Error('locked'));
  store.setItemAsync.mockRejectedValue(new Error('locked'));
  const s = await openChat();
  await waitFor(() => expect(store.getItemAsync).toHaveBeenCalledWith('kipRoomShrunk'));
  expect(s.getByTestId('kip-room-card')).toBeTruthy();
  await act(async () => {
    fireEvent.press(s.getByTestId('kip-shrink-room'));
  });
  expect(store.setItemAsync).toHaveBeenCalledWith('kipRoomShrunk', '1');
  expect(s.queryByTestId('kip-room-card')).toBeNull();
  await act(async () => {
    fireEvent.press(s.getByTestId('kip-room-thumbnail'));
  });
  expect(s.getByTestId('kip-room-card')).toBeTruthy();
});

it('the prefill lands in the input with the room on screen, and the consent round-trip carries it', async () => {
  const question = 'Why is my recovery where it is today?';
  (fetchCoachStatus as jest.Mock).mockResolvedValueOnce({ ...status, consented: false });
  mockNav.params = { prefill: question };
  const s = render(<CoachScreen />);
  await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('CoachConsent', { prefill: question }));
  await act(async () => mockNav.focus());
  await s.findByTestId('coach-input');
  expect(s.getByTestId('coach-input').props.value).toBe(question);
  expect(s.getByTestId('kip-room-card')).toBeTruthy();
});

it('passes Reduce Motion to the room (loops off)', async () => {
  mockReduceMotion = true;
  const s = await openChat();
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  await waitFor(() => expect(s.getByTestId('kip-room').props.room).toMatch(/:still:/));
});
