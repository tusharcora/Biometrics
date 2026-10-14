import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { fetchCosmetics, postCosmeticsSeen, putCosmetics } from '../../src/api/cosmetics';
import { DecorateRoomScreen } from '../../src/screens/DecorateRoomScreen';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
// The window's weather (useTodayScene): no scores and no night, and no real HTTP from Jest (ruling P29).
jest.mock('../../src/api/scores', () => ({ ...jest.requireActual('../../src/api/scores'), fetchScoresWithBands: jest.fn(async () => ({ scores: [], bands: undefined })) }));
jest.mock('../../src/api/sleep', () => ({ ...jest.requireActual('../../src/api/sleep'), fetchSleep: jest.fn(async () => ({ nights: [] })) }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined) }));
// addListener keeps the newest listener per event, so a test can fire beforeRemove as the navigator would.
type RemoveEvent = { preventDefault: () => void; data: { action: unknown } };
const mockListeners: Record<string, (e: RemoveEvent) => void> = {};
const mockNav = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  addListener: jest.fn((event: string, cb: (e: RemoveEvent) => void) => {
    mockListeners[event] = cb;
    return () => undefined;
  }),
  dispatch: jest.fn(),
};
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
}));

const DTO = {
  catalogueVersion: 1, owned: ['wall.plain', 'wall.dots', 'rug.slate', 'rug.red', 'art.calendar', 'out.beanie', 'out.earbuds'],
  fresh: [{ itemId: 'rug.red', source: 'family:SLEEP_GOAL:1' }], room: { ...STARTER_LOADOUT }, worn: { ...EMPTY_WORN }, version: 2,
  counters: { recapsRead: 1, buddyCheers: 0 },
};

async function open(params?: object) {
  mockParams = params;
  (fetchCosmetics as jest.Mock).mockResolvedValue(DTO);
  await act(async () => { await loadCosmetics(); });
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  return s;
}
const room = (s: ReturnType<typeof render>) => JSON.parse(s.getByTestId('decorate-room').props.loadout);

beforeEach(() => {
  jest.clearAllMocks();
  resetCosmetics();
});

it('shows the header, the room with 12 hotspot tags, the info line and the three tabs, Room selected', async () => {
  const s = await open();
  expect(s.getByText('DECORATE')).toBeTruthy();
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
  expect(s.getAllByTestId(/^decorate-hotspot-/)).toHaveLength(12);
  expect(s.getByTestId('decorate-hotspot-art').props.accessibilityLabel).toBe('Decorate the art');
  expect(s.getByTestId('decorate-tab-room').props.accessibilityState).toMatchObject({ selected: true });
  expect(s.getByTestId('decorate-tab-kip').props.accessibilityState).toMatchObject({ selected: false });
  expect(s.getByTestId('decorate-tabs').props.accessibilityRole).toBe('tablist');
});

it('marks everything shown as seen on open', async () => {
  await open();
  expect(postCosmeticsSeen).toHaveBeenCalledWith(['rug.red']);
});

it('a hotspot selects its slot\'s category', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('decorate-hotspot-rug'));
  expect(s.getByTestId('decorate-chip-rug').props.accessibilityState).toMatchObject({ selected: true });
  expect(s.getByTestId('decorate-tile-rug.red')).toBeTruthy();
});

it('placing an owned piece redraws the room at once and enables Done', async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  expect(room(s).rug).toBe('rug.red');
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(false);
  expect(s.getByTestId('decorate-info').props.accessibilityLabel).toBe('Previewing, Red rug in the rug spot');
});

it('a locked piece previews with a dashed LOCKED tag on its slot and the way to earn it', async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.gymmat'));
  expect(room(s).rug).toBe('rug.gymmat');
  expect(s.getByTestId('decorate-locked-rug')).toBeTruthy();
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
  expect(s.getByTestId('decorate-tile-rug.gymmat').props.accessibilityLabel).toBe('Gym mat, locked. Step goal, level 1. No level yet');
});

it('Undo steps back; Cancel without changes just closes; with changes it asks first', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-cancel'));
  expect([mockNav.goBack.mock.calls.length, alert.mock.calls.length]).toEqual([1, 0]);
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  fireEvent.press(s.getByTestId('decorate-undo'));
  expect(room(s).rug).toBe('rug.slate');
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  fireEvent.press(s.getByTestId('decorate-cancel'));
  expect(alert.mock.calls[0]![0]).toBe('Discard your changes?');
  const buttons = alert.mock.calls[0]![2]!;
  expect(buttons.map((b) => b.text)).toEqual(['Keep editing', 'Discard']);
  act(() => buttons[1]!.onPress!());
  expect(mockNav.goBack).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});

it('lets a back gesture or Android back through unchanged, and asks first once something changed', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const s = await open({ slot: 'rug' });
  const event = (): RemoveEvent => ({ preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } });
  const unchanged = event();
  mockListeners.beforeRemove!(unchanged);
  expect([(unchanged.preventDefault as jest.Mock).mock.calls.length, alert.mock.calls.length]).toEqual([0, 0]);

  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  const changed = event();
  mockListeners.beforeRemove!(changed);
  expect(changed.preventDefault).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0]![0]).toBe('Discard your changes?');
  expect(mockNav.dispatch).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2]!;
  act(() => buttons[1]!.onPress!());
  expect(mockNav.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  // Once discarding, the removal it dispatched passes straight through.
  const again = event();
  mockListeners.beforeRemove!(again);
  expect([(again.preventDefault as jest.Mock).mock.calls.length, alert.mock.calls.length]).toEqual([0, 1]);
  alert.mockRestore();
});

it('marks the hotspot of the slot being decorated as selected, and gives each a 44 pt tall touch target', async () => {
  const s = await open({ slot: 'rug' });
  expect(s.getByTestId('decorate-hotspot-rug').props.accessibilityState).toMatchObject({ selected: true });
  expect(s.getByTestId('decorate-hotspot-art').props.accessibilityState).toMatchObject({ selected: false });
  fireEvent.press(s.getByTestId('decorate-hotspot-art'));
  expect(s.getByTestId('decorate-hotspot-art').props.accessibilityState).toMatchObject({ selected: true });
  expect(s.getByTestId('decorate-hotspot-desk_item')).toHaveTextContent('+ ITEM');
  expect(s.getByTestId('decorate-hotspot-desk_item').props.accessibilityLabel).toBe('Decorate the desk item');
  expect(s.getByTestId('decorate-hotspot-wallpaper')).toHaveTextContent('+ WALL');
  expect(s.getByTestId('decorate-hotspot-wallpaper').props.accessibilityLabel).toBe('Decorate the wallpaper');
  for (const tag of s.getAllByTestId(/^decorate-hotspot-/)) {
    const { hitSlop, style } = tag.props;
    const height = StyleSheet.flatten(style).height as number;
    expect(height + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
  }
});

it('can be left while the room is loading', async () => {
  mockParams = undefined;
  (fetchCosmetics as jest.Mock).mockReturnValue(new Promise(() => undefined));
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('decorate-loading')).toBeTruthy();
  fireEvent.press(s.getByTestId('decorate-cancel'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

it('says so when the room cannot load, and offers Try again and Close', async () => {
  mockParams = undefined;
  (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('decorate-load-failed')).toHaveTextContent("Couldn't open your room just now. Check your connection and try again.", { exact: false });
  expect(s.queryByTestId('decorate-loading')).toBeNull();

  (fetchCosmetics as jest.Mock).mockResolvedValue(DTO);
  await act(async () => {
    fireEvent.press(s.getByTestId('decorate-retry'));
  });
  expect(fetchCosmetics).toHaveBeenCalledTimes(2);
  expect(s.getByTestId('decorate-room')).toBeTruthy();
  expect(s.queryByTestId('decorate-load-failed')).toBeNull();
});

it('closes from the load error', async () => {
  mockParams = undefined;
  (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  fireEvent.press(s.getByTestId('decorate-close'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});
