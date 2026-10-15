import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { RoomToastHost, ROOM_TOAST_MS } from '../../src/components/room/RoomToastHost';
import { getAchievementsSnapshot, pendingLevels } from '../../src/lib/achievementsStore';
import { loadCosmetics } from '../../src/lib/room/cosmeticsStore';
import { navigationRef } from '../../src/navigation/navigationRef';

jest.mock('../../src/lib/room/cosmeticsStore', () => ({ loadCosmetics: jest.fn() }));
jest.mock('../../src/lib/achievementsStore', () => ({ getAchievementsSnapshot: jest.fn(() => ({})), pendingLevels: jest.fn(() => []) }));
jest.mock('../../src/navigation/navigationRef', () => ({
  MODAL_ROUTES: new Set(['RecapStory', 'DecorateRoom']),
  navigationRef: { isReady: () => true, getCurrentRoute: jest.fn(() => ({ name: 'Home' })), addListener: jest.fn(() => () => undefined), navigate: jest.fn() },
}));
const load = loadCosmetics as jest.Mock;
const pending = pendingLevels as jest.Mock;
const store: Record<string, string> = {};
jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (k) => store[k] ?? null);
jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (k, v) => { store[k] = v; });

const cosmetics = (fresh: Array<{ itemId: string; source: string }>) => ({ fresh, owned: new Set(), room: {}, worn: {}, version: 1, counters: { recapsRead: 0, buddyCheers: 0 } });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  jest.clearAllMocks();
  (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Home' });
  (navigationRef.addListener as jest.Mock).mockImplementation(() => () => undefined);
  pending.mockReturnValue([]);
  (getAchievementsSnapshot as jest.Mock).mockReturnValue({});
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('shows a new piece once with a Decorate button that opens decorate mode on its slot, and hides after 6 s', async () => {
  load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(s.getByText("New for KIP's room: Wood panel")).toBeTruthy();
  fireEvent.press(s.getByTestId('room-toast-decorate'));
  expect(navigationRef.navigate).toHaveBeenCalledWith('DecorateRoom', { drawer: 'new', item: 'wall.panel' });
  expect(s.queryByTestId('room-toast')).toBeNull();
  s.unmount();
  const again = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(again.queryByTestId('room-toast')).toBeNull(); // the device list remembers it
  expect(JSON.parse(store.kipToasted!)).toEqual({ ids: ['wall.panel'], backfill: 0 });
});

it('still toasts when the keychain throws (it may repeat later, it never crashes)', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
  load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(s.getByTestId('room-toast')).toBeTruthy();
  act(() => { jest.advanceTimersByTime(ROOM_TOAST_MS - 1); });
  expect(s.getByTestId('room-toast')).toBeTruthy();
  act(() => { jest.advanceTimersByTime(1); });
  expect(s.queryByTestId('room-toast')).toBeNull();
});

it('waits while a modal route is up, and checks again on the next foreground', async () => {
  (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'DecorateRoom' });
  load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
  const listeners: Array<(s: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => { listeners.push(cb as (s: string) => void); return { remove: () => undefined } as never; });
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(s.queryByTestId('room-toast')).toBeNull();
  expect(store.kipToasted).toBeUndefined(); // held, not spent
  (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Coach' });
  await act(async () => { listeners.forEach((l) => l('active')); });
  expect(s.getByTestId('room-toast')).toBeTruthy();
});

it('waits while a badge celebration is pending (it names its own pieces)', async () => {
  pending.mockReturnValue([{ id: 's1' }]);
  load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(s.queryByTestId('room-toast')).toBeNull();
  expect(store.kipToasted).toBeUndefined();
});

it('checks again when the KIP tab gains focus', async () => {
  let onState: () => void = () => undefined;
  (navigationRef.addListener as jest.Mock).mockImplementation((_e: string, cb: () => void) => { onState = cb; return () => undefined; });
  load.mockResolvedValue(cosmetics([]));
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(load).toHaveBeenCalledTimes(1);
  load.mockResolvedValue(cosmetics([{ itemId: 'art.cork', source: 'counter:buddy_cheers:5' }]));
  (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue({ name: 'Coach' });
  await act(async () => onState());
  expect(load).toHaveBeenCalledTimes(2);
  expect(s.getByText("New for KIP's room: Cork board with notes")).toBeTruthy();
  // Staying on the KIP tab is not a new focus.
  await act(async () => onState());
  expect(load).toHaveBeenCalledTimes(2);
});

it('summarises the backfill once (Review Focus 2) and its Decorate opens decorate mode where it opens', async () => {
  const backfill = ['pet.bed', 'rug.red', 'wall.stripes', 'art.motto', 'shelf.trophyB', 'out.beanie', 'plant.cactus', 'lamp.amber', 'rug.gymmat']
    .map((itemId) => ({ itemId, source: 'backfill' }));
  load.mockResolvedValue(cosmetics(backfill));
  const listeners: Array<(s: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => { listeners.push(cb as (s: string) => void); return { remove: () => undefined } as never; });
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(s.getByText("Your badges unlocked 9 things for KIP's room")).toBeTruthy();
  act(() => { jest.advanceTimersByTime(ROOM_TOAST_MS); });
  await act(async () => { listeners.forEach((l) => l('active')); });
  expect(s.queryByTestId('room-toast')).toBeNull();
  // A piece earned after launch gets its own toast.
  load.mockResolvedValue(cosmetics([...backfill, { itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
  await act(async () => { listeners.forEach((l) => l('active')); });
  expect(s.getByText("New for KIP's room: Wood panel")).toBeTruthy();
});

describe('with a screen reader', () => {
  const reader = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(on);

  it('stays until it is used or dismissed, with a hint for its action', async () => {
    reader(true);
    load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
    const s = render(<RoomToastHost />);
    await act(async () => undefined);
    const toast = s.getByTestId('room-toast');
    expect(toast.props.accessibilityHint).toBe("Opens decorate mode for KIP's room");
    act(() => { jest.advanceTimersByTime(ROOM_TOAST_MS * 10); });
    expect(s.getByTestId('room-toast')).toBeTruthy();
    fireEvent(s.getByTestId('room-toast'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(navigationRef.navigate).toHaveBeenCalledWith('DecorateRoom', { drawer: 'new', item: 'wall.panel' });
    expect(s.queryByTestId('room-toast')).toBeNull();
  });

  it('without one, goes after 6 s', async () => {
    reader(false);
    load.mockResolvedValue(cosmetics([{ itemId: 'wall.panel', source: 'counter:recaps_read:4' }]));
    const s = render(<RoomToastHost />);
    await act(async () => undefined);
    expect(s.getByTestId('room-toast').props.accessibilityHint).toBe("Opens decorate mode for KIP's room");
    act(() => { jest.advanceTimersByTime(ROOM_TOAST_MS); });
    expect(s.queryByTestId('room-toast')).toBeNull();
  });
});

it('announces the toast on iOS without the "·", and offers Decorate and Dismiss as actions', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  load.mockResolvedValue(cosmetics([{ itemId: 'art.band', source: 'counter:buddy_cheers:10' }]));
  const s = render(<RoomToastHost />);
  await act(async () => undefined);
  expect(announce).toHaveBeenCalledWith("New for KIP's room: Band poster, “The Naps”");
  const toast = s.getByTestId('room-toast');
  expect(toast.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['activate', 'escape']);
  fireEvent(toast, 'accessibilityAction', { nativeEvent: { actionName: 'escape' } });
  expect(s.queryByTestId('room-toast')).toBeNull();
  expect(navigationRef.navigate).not.toHaveBeenCalled();
});
