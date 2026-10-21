import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { cheerBuddyRoom, fetchBuddyRoom } from '../../src/api/rooms';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { loadCoins } from '../../src/lib/coins/coinsStore';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { BuddyRoomScreen } from '../../src/screens/BuddyRoomScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/rooms', () => ({ fetchBuddyRoom: jest.fn(), cheerBuddyRoom: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
jest.mock('../../src/lib/coins/coinsStore', () => ({ ...jest.requireActual('../../src/lib/coins/coinsStore'), loadCoins: jest.fn(async () => null) }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: { buddyId: 'b1', name: 'Maya' } }) }));

const BODY = { name: 'Maya', layout: starterLayout(), size: { n: 8, m: 8 }, kipColour: 'lime', kipWorn: { head: null, face: null, neck: null, ears: null }, cheersThisWeek: 3, cheeredToday: false };

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { await loadCosmetics(); });
});

async function open(body: object = BODY) {
  (fetchBuddyRoom as jest.Mock).mockResolvedValue(body);
  render(<BuddyRoomScreen />);
  await act(async () => undefined);
}

it('shows their room neutral: size only, their KIP waving, nothing selectable (spec §10.1, ruling 24)', async () => {
  await open();
  expect(fetchBuddyRoom).toHaveBeenCalledWith('b1');
  // PF4-F14: the title is drawn in capitals and read in its own case.
  expect(screen.getByTestId('visit-title').props.accessibilityLabel).toBe("Maya's room");
  expect(screen.getByTestId('visit-size')).toHaveTextContent('8 × 8 · 7 pieces');
  expect(screen.getByTestId('visit-size').props.accessibilityLabel).toBe('8 by 8, 7 pieces');
  const room = screen.getByTestId('visit-room');
  expect(room.props.living).toBeUndefined(); // NEUTRAL_LIVING: plants grown, the cat wandering, the shelf empty
  expect(room.props.live).toBe('live'); // PF4-F7: the visited room's cat wanders
  expect(room.props.walks).toBe(''); // KIP stays at its desk, waving
  expect(room.props.editing).toBe(false);
  expect(room.props.room).toMatch(/^wave:idle:HI THERE!:lines:fallback:(day|night):lime:2:/);
  expect(room.props.accessibilityActions).toBeUndefined();
  expect(room.props.accessibilityLabel).toBe("Maya's room, with their KIP waving");
  expect(screen.getByText("Just looking: you can't move anything")).toBeTruthy();
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('3 cheers this week');
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent("Cheer Maya's room");
});

it('shows nothing but the room, KIP, the size and the cheer count: no numbers, coins or awards (spec §10.1)', async () => {
  await open({ ...BODY, coins: 999, living: { plantStage: 1, petEnergy: 'nap', awards: [1, 2] }, sleepScore: 81 });
  const room = screen.getByTestId('visit-room');
  expect(room.props.living).toBeUndefined();
  expect(screen.queryByText(/999|81/)).toBeNull();
});

it('cheers once a day: the button turns into "Cheered today" and the count goes up (spec §10.2)', async () => {
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  (cheerBuddyRoom as jest.Mock).mockResolvedValue({ paid: true });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(cheerBuddyRoom).toHaveBeenCalledWith('b1');
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent('Cheered today');
  expect(screen.getByTestId('visit-cheer').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('4 cheers this week');
  expect(screen.getByTestId('visit-note')).toHaveTextContent('Cheered! +2 coins');
  if (Platform.OS === 'ios') expect(say).toHaveBeenCalledWith('Cheered! Plus 2 coins');
  // The +2 landed after the server's commit: the wallet reads afresh (FINAL-M1).
  expect(loadCoins).toHaveBeenCalledWith({ fresh: true });
  say.mockRestore();
});

it('a cheer past the day\'s paid cheers still counts, without the coins; a double tap cheers once', async () => {
  let resolve!: (v: { paid: boolean }) => void;
  (cheerBuddyRoom as jest.Mock).mockImplementation(() => new Promise((r) => { resolve = r; }));
  await open();
  fireEvent.press(screen.getByTestId('visit-cheer'));
  fireEvent.press(screen.getByTestId('visit-cheer'));
  await act(async () => resolve({ paid: false }));
  expect(cheerBuddyRoom).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('visit-note')).toHaveTextContent(/^Cheered!$/);
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('4 cheers this week');
  // Nothing was paid, so the wallet is not read.
  expect(loadCoins).not.toHaveBeenCalled();
});

it('a room already cheered today shows as cheered; one cheered on open is cheered from the start', async () => {
  (cheerBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(409, 'already_cheered', 'already_cheered'));
  await open();
  // This tap's first try landed and its answer was lost: the server now counts it (FINAL-M2).
  (fetchBuddyRoom as jest.Mock).mockResolvedValue({ ...BODY, cheersThisWeek: 4, cheeredToday: true });
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent('Cheered today');
  // The room is read again, so the count holds the cheer that landed.
  expect(fetchBuddyRoom).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('4 cheers this week');
  screen.unmount();
  await open({ ...BODY, cheeredToday: true, cheersThisWeek: 1 });
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent('Cheered today');
  expect(screen.getByTestId('visit-cheer').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('1 cheer this week');
});

it('every refusal is the one neutral closed room, never why: on open, and on a cheer after it closed (ruling 8)', async () => {
  (fetchBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(404, 'not_found', 'not_found'));
  render(<BuddyRoomScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('visit-closed')).toHaveTextContent("This room isn't open for visits.");
  expect(screen.queryByTestId('visit-retry')).toBeNull();
  screen.unmount();
  (cheerBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(404, 'not_found', 'not_found'));
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(screen.getByTestId('visit-closed')).toHaveTextContent("This room isn't open for visits.");
  expect(screen.queryByTestId('visit-room')).toBeNull();
});

it('a busy server on a cheer reads the neutral busy line and leaves the cheer offered (503 try_later, FINAL-I2)', async () => {
  (cheerBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(503, 'try_later', 'try_later'));
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(screen.getByTestId('visit-note')).toHaveTextContent("Couldn't do that just now.");
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent("Cheer Maya's room");
  expect(screen.getByTestId('visit-cheer').props.accessibilityState).toMatchObject({ disabled: false });
});

it('a failed open offers Try again, which reads the room again', async () => {
  (fetchBuddyRoom as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'try_later', 'try_later'));
  render(<BuddyRoomScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('visit-error')).toHaveTextContent("Couldn't open this room just now.");
  (fetchBuddyRoom as jest.Mock).mockResolvedValue(BODY);
  await act(async () => { fireEvent.press(screen.getByTestId('visit-retry')); });
  expect(fetchBuddyRoom).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('visit-room')).toBeTruthy();
});

it('lists the pieces you don\'t have; tapping one says how to get it, never what they earned (ruling 27)', async () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces,
    { id: 'p1', item: 'corner.gnome', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false },
    { id: 'p2', item: 'plant.monstera', layer: 'floor', x: 5, y: 6, facing: 'L', mirror: false }] };
  await open({ ...BODY, layout });
  expect(screen.getByText("Pieces you don't have")).toBeTruthy();
  expect(screen.queryByTestId('visit-missing-plant.fern')).toBeNull(); // the starter fern is yours too
  fireEvent.press(screen.getByTestId('visit-missing-corner.gnome'));
  expect(screen.getByTestId('visit-missing-info')).toHaveTextContent('Gnome80 coins in the coin shop');
  fireEvent.press(screen.getByTestId('visit-missing-plant.monstera'));
  expect(screen.getByTestId('visit-missing-info')).toHaveTextContent('MonsteraSleep goal · I');
  expect(screen.queryByText(/earned/)).toBeNull();
  // PF4-F15: spoken with the spoken name and rule, never "·" or a numeral.
  const label = screen.getByTestId('visit-missing-plant.monstera').props.accessibilityLabel as string;
  expect(label).toBe('Monstera. Sleep goal, level 1');
  expect(label).not.toMatch(/·/);
  expect(screen.getByTestId('visit-missing-info').props.accessibilityLabel).toBe('Monstera. Sleep goal, level 1');
});

it('lists no pieces when you have every one they placed', async () => {
  await open();
  expect(screen.queryByText("Pieces you don't have")).toBeNull();
});

it('opens Send a gift for this buddy', async () => {
  await open();
  fireEvent.press(screen.getByTestId('visit-gift'));
  expect(mockNav.navigate).toHaveBeenCalledWith('GiftSend', { buddyId: 'b1', name: 'Maya' });
});

it('every button is at least 44 pt and rounded-lg, never a pill', async () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.gnome', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false }] };
  await open({ ...BODY, layout });
  for (const id of ['visit-cheer', 'visit-gift', 'visit-missing-corner.gnome']) {
    const classes = String(screen.getByTestId(id).props.className).split(' ');
    expect({ id, tall: classes.some((c) => c === 'h-[44px]' || c === 'min-h-[64px]'), pill: classes.includes('rounded-full') }).toEqual({ id, tall: true, pill: false });
  }
});

it('a screen reader lands on the title once the room is shown', async () => {
  const handle = jest.spyOn(require('react-native'), 'findNodeHandle').mockImplementation(((el: unknown) => el) as never);
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  await open();
  expect(focus.mock.calls.map(([el]) => (el as unknown as { props?: { testID?: string } }).props?.testID)).toEqual(['visit-title']);
  handle.mockRestore();
  focus.mockRestore();
});

it('keeps the title, the size and the room above the scroll: only the cheer, the gift and the pieces scroll (T9-FIX)', async () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.gnome', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false }] };
  await open({ ...BODY, layout });
  const top = within(screen.getByTestId('visit-top'));
  const scroll = within(screen.getByTestId('visit-scroll'));
  for (const id of ['visit-title', 'visit-size', 'visit-room']) {
    expect(top.queryByTestId(id)).toBeTruthy();
    expect(scroll.queryByTestId(id)).toBeNull();
  }
  for (const id of ['visit-cheer', 'visit-cheers', 'visit-gift', 'visit-missing-corner.gnome']) expect(scroll.queryByTestId(id)).toBeTruthy();
});

it('reads your cosmetics when they are not loaded yet, and lists no pieces until they are (T9-FIX)', async () => {
  resetCosmetics();
  let resolve!: (v: unknown) => void;
  (fetchCosmetics as jest.Mock).mockClear().mockImplementation(() => new Promise((r) => { resolve = r; }));
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.gnome', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false }] };
  await open({ ...BODY, layout });
  expect(fetchCosmetics).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('visit-room')).toBeTruthy();
  // Not "everything is missing": the list waits for your own counts.
  expect(screen.queryByText("Pieces you don't have")).toBeNull();
  expect(screen.queryByTestId('visit-missing-plant.fern')).toBeNull();
  await act(async () => resolve(cosmeticsDTO()));
  expect(screen.getByText("Pieces you don't have")).toBeTruthy();
  expect(screen.getByTestId('visit-missing-corner.gnome')).toBeTruthy();
  expect(screen.queryByTestId('visit-missing-plant.fern')).toBeNull();
});

it('does not read your cosmetics again when they are already loaded', async () => {
  (fetchCosmetics as jest.Mock).mockClear();
  await open();
  expect(fetchCosmetics).not.toHaveBeenCalled();
});

