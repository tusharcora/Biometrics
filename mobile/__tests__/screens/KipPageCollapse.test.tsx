import { mockNav, openChat, status } from '../../jest-mocks/coachScreenHarness';
import React from 'react';
import { AccessibilityInfo, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { fetchCoachStatus } from '../../src/api/coach';
import { CoachScreen } from '../../src/screens/CoachScreen';

// The mocks (api, navigation, RoomView, the room's score and sleep reads) live in jest-mocks/coachScreenHarness.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('../../src/lib/kipRoomPrefs', () => ({ readKipRoomShrunk: jest.fn(), writeKipRoomShrunk: jest.fn() }));
let mockReduceMotion = false;
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(mockReduceMotion));

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
const layCard = (s: ReturnType<typeof render>) =>
  fireEvent(s.getByTestId('kip-room-card'), 'layout', { nativeEvent: { layout: { x: 20, y: 12, width: 335, height: 300 } } });

beforeEach(() => {
  mockReduceMotion = false;
  prefs.readKipRoomShrunk.mockResolvedValue(false);
  prefs.writeKipRoomShrunk.mockResolvedValue(undefined);
  store.getItemAsync.mockResolvedValue(null);
  store.setItemAsync.mockResolvedValue(undefined);
});

// The card's bottom is 12 + 300 = 312 and the header is 60 tall: it is fully in at 252 and starts at 228.
it('collapse: the header appears once the card\'s bottom (312) passes under it (60), fading over 24 points', async () => {
  const s = await openChat();
  layCard(s);
  await scrollTo(s, 200);
  expect(s.queryByTestId('kip-collapsed-header')).toBeNull();
  await scrollTo(s, 240);
  expect(s.getByTestId('kip-collapsed-header')).toHaveAnimatedStyle({ opacity: 0.5 });
  // Taps reach the expanded header under it until it is fully in.
  expect(s.getByTestId('kip-collapsed-header').props.pointerEvents).toBe('none');
  await scrollTo(s, 260);
  expect(s.getByTestId('kip-collapsed-header')).toHaveAnimatedStyle({ opacity: 1 });
  expect(s.getByTestId('kip-collapsed-header').props.pointerEvents).toBe('auto');
  expect(s.getByTestId('kip-collapsed-status')).toHaveTextContent('In the pocket room');
  await scrollTo(s, 100);
  expect(s.queryByTestId('kip-collapsed-header')).toBeNull();
});

it('under Reduce Motion the collapsed header switches at the threshold, with no fade', async () => {
  mockReduceMotion = true;
  const s = await openChat();
  layCard(s);
  await scrollTo(s, 240);
  expect(s.queryByTestId('kip-collapsed-header')).toBeNull();
  await scrollTo(s, 252);
  expect(s.getByTestId('kip-collapsed-header')).toHaveAnimatedStyle({ opacity: 1 });
});

it('the thumbnail scrolls back to the top', async () => {
  const s = await openChat();
  layCard(s);
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
