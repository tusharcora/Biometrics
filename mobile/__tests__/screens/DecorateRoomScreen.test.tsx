import React from 'react';
import { AccessibilityInfo, Alert, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics, postCosmeticsSeen, putCosmetics } from '../../src/api/cosmetics';
import { DecorateRoomScreen } from '../../src/screens/DecorateRoomScreen';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
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

it('Done saves the draft with the stored version, then closes', async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  (putCosmetics as jest.Mock).mockResolvedValue({ ...DTO, room: { ...DTO.room, rug: 'rug.red' }, version: 3 });
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect(putCosmetics).toHaveBeenCalledWith({ room: { ...STARTER_LOADOUT, rug: 'rug.red' }, worn: EMPTY_WORN, version: 2 });
  expect(getCosmetics()!.room.rug).toBe('rug.red');
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('a locked preview is never saved: Done sends what was there', async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-hotspot-pet'));
  fireEvent.press(s.getByTestId('decorate-tile-pet.bed')); // not owned in DTO: a preview
  fireEvent.press(s.getByTestId('decorate-hotspot-wallpaper'));
  fireEvent.press(s.getByTestId('decorate-tile-wall.dots'));
  (putCosmetics as jest.Mock).mockResolvedValue({ ...DTO, version: 3 });
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect((putCosmetics as jest.Mock).mock.calls[0]![0].room.pet).toBeNull();
});

it.each([[403, 'not_owned'], [409, 'stale']])('a %i refreshes the room, keeps you here and says so', async (status, code) => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(status, code, code));
  (fetchCosmetics as jest.Mock).mockResolvedValue({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.dots' }, version: 5 });
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect(s.getByText('Something changed on another device. Your room was refreshed.')).toBeTruthy();
  expect([room(s).wallpaper, room(s).rug]).toEqual(['wall.dots', 'rug.slate']);
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
  expect(mockNav.goBack).not.toHaveBeenCalled();
});

it("after a 409 refresh, the next change saves against the server's version (two devices)", async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  (putCosmetics as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'stale', 'stale'));
  (fetchCosmetics as jest.Mock).mockResolvedValue({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.dots' }, version: 5 });
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect(s.getByTestId('decorate-undo').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  expect(s.queryByTestId('decorate-notice')).toBeNull();
  (putCosmetics as jest.Mock).mockResolvedValue({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.dots', rug: 'rug.red' }, version: 6 });
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect((putCosmetics as jest.Mock).mock.calls[1]![0]).toEqual({ room: { ...STARTER_LOADOUT, wallpaper: 'wall.dots', rug: 'rug.red' }, worn: EMPTY_WORN, version: 5 });
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

it('any other failure keeps the draft and asks to try again', async () => {
  const s = await open({ slot: 'rug' });
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  (putCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect(s.getByText("Couldn't save your room. Try again.")).toBeTruthy();
  expect(room(s).rug).toBe('rug.red');
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(false);
  expect(mockNav.goBack).not.toHaveBeenCalled();
});

it('disables Done while a save is in flight, and announces the notice on iOS', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const os = Platform.OS;
  Platform.OS = 'ios';
  try {
    const s = await open({ slot: 'rug' });
    fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
    let fail!: (e: Error) => void;
    (putCosmetics as jest.Mock).mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
    expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
    await act(async () => { fail(new Error('offline')); });
    expect(announce).toHaveBeenCalledWith("Couldn't save your room. Try again.");
  } finally {
    Platform.OS = os;
    announce.mockRestore();
  }
});

it('Done keeps a stored id this build cannot draw in a slot you did not touch', async () => {
  mockParams = { slot: 'rug' };
  (fetchCosmetics as jest.Mock).mockResolvedValue({ ...DTO, room: { ...DTO.room, art: 'art.fromTheFuture' } });
  await act(async () => { await loadCosmetics(); });
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  expect(room(s).art).toBe('art.calendar'); // drawn as the starter piece
  fireEvent.press(s.getByTestId('decorate-tile-rug.red'));
  (putCosmetics as jest.Mock).mockResolvedValue(DTO);
  await act(async () => { fireEvent.press(s.getByTestId('decorate-done')); });
  expect((putCosmetics as jest.Mock).mock.calls[0]![0].room.art).toBe('art.fromTheFuture');
});

it('the KIP tab groups worn pieces by head, face, neck and ears and draws KIP large wearing the preview', async () => {
  const s = await open({ tab: 'kip' });
  expect(s.getByTestId('decorate-tab-kip').props.accessibilityState).toMatchObject({ selected: true });
  expect(['head', 'face', 'neck', 'ears'].map((g) => !!s.queryByTestId(`decorate-group-${g}`))).toEqual([true, true, true, true]);
  fireEvent.press(s.getByTestId('decorate-tile-out.beanie'));
  expect(s.getByTestId('decorate-kip', { includeHiddenElements: true })).toBeTruthy();
  expect(JSON.parse(s.getByTestId('decorate-room').props.worn).head).toBe('out.beanie');
  expect(s.getByTestId('decorate-info').props.accessibilityLabel).toBe('KIP is wearing, Beanie');
});

it('the Sets tab: Preview for a locked set (nothing saveable), Apply set for an owned one (one Undo step)', async () => {
  const s = await open({ tab: 'sets' });
  const card = s.getByTestId('decorate-set-cottage');
  expect(within(card).getByText('13 pieces · Read 4 weekly recaps')).toBeTruthy();
  fireEvent.press(within(card).getByTestId('decorate-set-cottage-action'));
  expect(room(s).wallpaper).toBe('set.cottage.wallpaper');
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
  expect(s.getByTestId('decorate-info').props.accessibilityLabel).toBe('Locked, Cottage, Read 4 weekly recaps');
});

it('the Sets tab: an owned set reads Apply set, fills every room slot and the beanie, and one Undo restores the starter room', async () => {
  const cottage = {
    wallpaper: 'set.cottage.wallpaper', floor: 'set.cottage.floor', art: 'set.cottage.art', window: 'set.cottage.window',
    shelf: 'set.cottage.shelf', desk: 'set.cottage.desk', desk_item: 'set.cottage.desk_item', plant: 'plant.fern',
    lamp: 'set.cottage.lamp', corner: 'set.cottage.corner', rug: 'set.cottage.rug', pet: 'set.cottage.pet',
  };
  mockParams = { tab: 'sets' };
  (fetchCosmetics as jest.Mock).mockResolvedValue({ ...DTO, owned: [...DTO.owned, ...Object.values(cottage)] });
  await act(async () => { await loadCosmetics(); });
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  const action = s.getByTestId('decorate-set-cottage-action');
  expect(action).toHaveTextContent('Apply set');
  expect(action.props.accessibilityLabel).toBe('Apply the Cottage set');
  fireEvent.press(action);
  expect(room(s)).toEqual(cottage);
  expect(JSON.parse(s.getByTestId('decorate-room').props.worn).head).toBe('out.beanie');
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(s.getByTestId('decorate-undo'));
  expect(room(s)).toEqual(STARTER_LOADOUT);
  expect(s.getByTestId('decorate-done').props.accessibilityState.disabled).toBe(true);
});

it('ends the tray with "How new things arrive" and says nothing is sold', async () => {
  const s = await open();
  expect(s.getByText('How new things arrive')).toBeTruthy();
  expect(s.getByText(/Nothing is sold\./)).toBeTruthy();
});
