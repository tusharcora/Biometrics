import React from 'react';
import * as ReactNative from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ApiError } from '../../src/api/client';
import { fetchCoins, fetchFirstWeek, postExpand, type ExpandDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetCoins } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { RoomSizesScreen } from '../../src/screens/RoomSizesScreen';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
let mockBadges: unknown;
jest.mock('../../src/lib/achievementsStore', () => ({ useAchievements: () => mockBadges, refreshAchievements: jest.fn(async () => undefined) }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), addListener: jest.fn((_event: string, _cb: unknown) => () => undefined) };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));
let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  // `default` (Animated) is not an own enumerable key, so a spread alone drops it.
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});

interface Open { balance: number; checkIn?: { level: number; current?: number }; sleepLevel?: number; params?: object; room?: ReturnType<typeof cosmeticsDTO> }

async function open({ balance, checkIn = { level: 1, current: 9 }, sleepLevel = 2, params, room = cosmeticsDTO() }: Open) {
  mockBadges = { state: { status: 'ready', data: achievementsFixture({ CHECK_IN: checkIn, SLEEP_GOAL: { level: sleepLevel } }) }, celebrated: new Set() };
  mockParams = params;
  (fetchCosmetics as jest.Mock).mockResolvedValue(room);
  (fetchCoins as jest.Mock).mockResolvedValue({ balance, today: { earned: 0, cap: 60 }, events: [], next: null });
  await act(async () => { await loadCosmetics(); });
  const s = render(<RoomSizesScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); resetCosmetics(); mockReduceMotion = false; });

it('shows each size, both gates of the next with progress, the next size\'s dashed rows, and why Grow waits (spec §7, C2)', async () => {
  const s = await open({ balance: 360 });
  expect(s.getByLabelText('Room sizes')).toBeTruthy(); // the page title, named as the first-week card names it (PF-F12)
  expect(s.getByTestId('sizes-row-1')).toHaveTextContent(/YOURS/);
  expect(s.getByTestId('sizes-coins-2').props.accessibilityLabel).toBe('600 coins, 360 of 600');
  expect(s.getByTestId('sizes-badge-2').props.accessibilityLabel).toBe('A 14-day check-in streak, 9 of 14');
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
  expect(s.getByText('Needs 240 more coins and 5 more days in a row.')).toBeTruthy();
  const room = s.getByTestId('sizes-room');
  expect([room.props.tier, room.props.room.split(':')[2]]).toEqual([2, 'none']);
});

it('waits for the wallet before it says what Grow needs', async () => {
  mockBadges = { state: { status: 'ready', data: achievementsFixture() }, celebrated: new Set() };
  mockParams = undefined;
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockReturnValue(new Promise(() => undefined));
  await act(async () => { await loadCosmetics(); });
  const s = render(<RoomSizesScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
  expect(s.queryByText(/^Needs/)).toBeNull();
  expect(s.queryByTestId('sizes-coins-2')).toBeNull();
});

it('with both gates met, Grow spends once, the room redraws grown with MORE ROOM!, and the card says what changed (Review Focus 4)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 }, params: { from: 'editor' } });
  const grown: ExpandDTO = { ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 50, stored: 0 };
  (postExpand as jest.Mock).mockResolvedValue(grown);
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(postExpand).toHaveBeenCalledWith(expect.stringMatching(/^00000000-/), 2);
  const room = s.getByTestId('sizes-room');
  expect([room.props.tier, room.props.room.split(':')[0], room.props.room.split(':')[2]]).toEqual([2, 'cheer', 'MORE ROOM!']);
  expect(s.getByTestId('sizes-grown')).toHaveTextContent(/NEW FLOORNEW WALLYour room grew600 coins and 14 days of check-ins in a row\.\+1 row each side · \+20 pieces/);
  // The two new effect slots, shown and read aloud (P3 ruling 20, T9-CARRY).
  const more = s.getByTestId('sizes-grown-more');
  expect(more).toHaveTextContent('+1 row each side · +20 pieces · +2 effect slots');
  expect(more.props.accessibilityLabel).toBe('One more row each side, 20 more pieces, 2 more effect slots');
  expect(s.queryByTestId('sizes-stored')).toBeNull();
  expect([getCosmetics()!.tier, getCosmetics()!.version]).toEqual([2, 3]);
  fireEvent.press(s.getByTestId('sizes-place'));
  expect(mockNav.goBack).toHaveBeenCalled(); // back to the editor that opened it
});

it('after a grow reads the room and the first-week list again, and an older read never shrinks the room (ruling T11T12-RELOAD)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (fetchCosmetics as jest.Mock).mockClear();
  (postExpand as jest.Mock).mockResolvedValue({ ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 50, stored: 0 });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect([(fetchCosmetics as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length]).toEqual([1, 1]);
  expect(getCosmetics()!.tier).toBe(2);
  fireEvent.press(s.getByTestId('sizes-later'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

it('to the loft the card says the window needed the wall; Place things opens the editor when it was not open', async () => {
  const s = await open({ balance: 1600, checkIn: { level: 2 }, sleepLevel: 3, room: cosmeticsDTO({ tier: 2, cap: 60, version: 2 }) });
  expect(s.getByTestId('sizes-room').props.tier).toBe(3);
  (postExpand as jest.Mock).mockResolvedValue({ ...cosmeticsDTO({ tier: 3, cap: 90, version: 4 }), balance: 100, stored: 2 });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-grown')).toHaveTextContent(/1,500 coins and the sleep goal badge, level 3\.\+1 row each side · \+30 pieces · \+3 effect slots · a second window/);
  expect(s.getByTestId('sizes-stored')).toHaveTextContent('The new window needed the wall: 2 pieces went to your inventory');
  fireEvent.press(s.getByTestId('sizes-place'));
  expect(mockNav.replace).toHaveBeenCalledWith('DecorateRoom');
});

it('the loft is the last size: no Grow', async () => {
  const s = await open({ balance: 0, room: cosmeticsDTO({ tier: 3, cap: 90, version: 2 }) });
  expect(s.queryByTestId('sizes-grow')).toBeNull();
  expect(s.getByTestId('sizes-row-3')).toHaveTextContent(/YOURS/);
});

it('a refused grow reads the wallet and the room again and says not yet; a dropped connection keeps the request id', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  const offline = new TypeError('Network request failed');
  (postExpand as jest.Mock).mockRejectedValueOnce(offline).mockRejectedValueOnce(offline)
    .mockRejectedValueOnce(new ApiError(409, 'x', 'gate', { error: 'gate', coinsNeeded: 10, badgeNeeded: false }));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-notice')).toHaveTextContent("Couldn't grow the room just now. Try again.");
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  const ids = (postExpand as jest.Mock).mock.calls.map((c) => c[0]);
  expect(ids).toEqual([ids[0], ids[0], ids[0]]); // the automatic re-send and the next tap are the same grow
  expect(s.getByTestId('sizes-notice')).toHaveTextContent('Not quite yet: your room sizes were refreshed.');
  expect((fetchCoins as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
});

describe('a grow whose answer was lost (ruling T13-FIX I1)', () => {
  it('is sent again once with the same id, and the replayed answer opens the unlock moment', async () => {
    const s = await open({ balance: 1600, checkIn: { level: 2 }, sleepLevel: 3, room: cosmeticsDTO({ tier: 2, cap: 60, version: 2 }) });
    // A replay answers stored 0, as the server does (plan ruling 17, ruling T14-CARRY): no line about the wall.
    (postExpand as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ...cosmeticsDTO({ tier: 3, cap: 90, version: 4 }), balance: 100, stored: 0 });
    await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
    const ids = (postExpand as jest.Mock).mock.calls.map((c) => c[0]);
    expect(ids).toEqual([ids[0], ids[0]]);
    expect(s.getByTestId('sizes-grown')).toHaveTextContent(/Your room grew/);
    expect(s.queryByTestId('sizes-stored')).toBeNull();
    expect(s.queryByTestId('sizes-notice')).toBeNull();
  });

  it('when the re-send is lost too, a room read again at the new size is the unlock moment', async () => {
    const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
    (postExpand as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ tier: 2, cap: 60, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
    expect((postExpand as jest.Mock).mock.calls).toHaveLength(2);
    expect(s.getByTestId('sizes-grown')).toHaveTextContent(/Your room grew/);
    expect(s.queryByTestId('sizes-stored')).toBeNull();
    expect(s.getByTestId('sizes-room').props.tier).toBe(2);
    expect(s.queryByTestId('sizes-notice')).toBeNull();
  });

  it('when the re-send is lost too, the room is read afresh, never from a read that started before the grow (ruling T14-CARRY)', async () => {
    const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
    // A focus read that began before the tap, still in flight, which saw the old size.
    let older: (v: unknown) => void = () => undefined;
    (fetchCosmetics as jest.Mock).mockReturnValueOnce(new Promise((r) => { older = r; }));
    void loadCosmetics();
    (postExpand as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ tier: 2, cap: 60, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
    await act(async () => { older(cosmeticsDTO({ version: 2 })); });
    expect(s.getByTestId('sizes-grown')).toHaveTextContent(/Your room grew/);
    expect(getCosmetics()!.tier).toBe(2);
    expect(s.queryByTestId('sizes-notice')).toBeNull();
  });

  it('when the re-send is lost and the room is still the old size, it says try again', async () => {
    const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
    (postExpand as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
    expect(s.queryByTestId('sizes-grown')).toBeNull();
    expect(s.getByTestId('sizes-notice')).toHaveTextContent("Couldn't grow the room just now. Try again.");
  });
});

it('the notice sits with Grow and its line, where the tap was (ruling T13-FIX M5)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(new ApiError(500, 'x'));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  const ids = s.getByTestId('sizes-grow-area').findAll((n) => typeof n.props.testID === 'string').map((n) => String(n.props.testID));
  expect(ids).toEqual(expect.arrayContaining(['sizes-grow', 'sizes-notice']));
});

it('holds the back button while a grow waits on the server (ruling T13-FIX M7)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  const remove = (mockNav.addListener.mock.calls.find((c) => c[0] === 'beforeRemove') ?? [])[1] as (e: { preventDefault: () => void }) => void;
  let answer: (v: unknown) => void = () => undefined;
  (postExpand as jest.Mock).mockReturnValueOnce(new Promise((r) => { answer = r; }));
  fireEvent.press(s.getByTestId('sizes-grow'));
  const held = { preventDefault: jest.fn() };
  remove(held);
  expect(held.preventDefault).toHaveBeenCalled();
  await act(async () => { answer({ ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 50, stored: 0 }); });
  const free = { preventDefault: jest.fn() };
  remove(free);
  expect(free.preventDefault).not.toHaveBeenCalled();
});

it('a cached room with a wallet that could not be read offers Try again (ruling T13-FIX M1)', async () => {
  mockBadges = { state: { status: 'ready', data: achievementsFixture() }, celebrated: new Set() };
  mockParams = undefined;
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(async () => { await loadCosmetics(); });
  const s = render(<RoomSizesScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('sizes-failed')).toBeTruthy();
  (fetchCoins as jest.Mock).mockResolvedValue({ balance: 360, today: { earned: 0, cap: 60 }, events: [], next: null });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-retry')); });
  expect(s.getByTestId('sizes-coins-2').props.accessibilityLabel).toBe('600 coins, 360 of 600');
});

it('with the badges unread, the badge gate is unknown, not 0, and a refused gate keeps its badgeNeeded (ruling T13-FIX M2)', async () => {
  const s = await open({ balance: 650 });
  mockBadges = { state: { status: 'error' }, celebrated: new Set() };
  s.rerender(<RoomSizesScreen />);
  expect(s.getByTestId('sizes-badge-2').props.accessibilityLabel).toBe('A 14-day check-in streak, not known yet');
  (postExpand as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'gate', { error: 'gate', coinsNeeded: 0, badgeNeeded: true }));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  // The wallet re-read landed (a new read), yet the badge the server found missing is still said.
  expect(s.getByTestId('sizes-blocker')).toHaveTextContent('Needs 14 more days in a row.');
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
});

it('a refused gate says what is still needed, from the wallet read again (ruling T11-ERR)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'gate', { error: 'gate', coinsNeeded: 10, badgeNeeded: false }));
  (fetchCoins as jest.Mock).mockResolvedValue({ balance: 590, today: { earned: 0, cap: 60 }, events: [], next: null });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByText('Needs 10 more coins.')).toBeTruthy();
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
});

it('when the wallet can\'t be read again, a refused gate says what is needed from its own answer', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'gate', { error: 'gate', coinsNeeded: 10, badgeNeeded: false }));
  (fetchCoins as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-notice')).toHaveTextContent('Not quite yet: your room sizes were refreshed.');
  expect(s.getByText('Needs 10 more coins.')).toBeTruthy();
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
});

it('a stale size reads the room again and says not yet (ruling T11-ERR)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'stale_tier', { error: 'stale_tier' }));
  (fetchCosmetics as jest.Mock).mockClear().mockResolvedValue(cosmeticsDTO({ tier: 2, cap: 60, version: 5 }));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(fetchCosmetics).toHaveBeenCalled();
  expect(s.getByTestId('sizes-notice')).toHaveTextContent('Not quite yet: your room sizes were refreshed.');
  expect(s.getByTestId('sizes-row-2')).toHaveTextContent(/YOURS/);
  expect(s.getByTestId('sizes-room').props.tier).toBe(3);
});

it.each([
  ['a bad body', new ApiError(400, 'x', 'invalid_body', { error: 'invalid_body' })],
  ['a stored room that can\'t be read', new ApiError(500, 'x', undefined, undefined)],
])('%s is a plain retry, never "not yet", and the next try is a new request (ruling T11-ERR, 30)', async (_name, err) => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(err).mockRejectedValueOnce(err);
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-notice')).toHaveTextContent("Couldn't grow the room just now. Try again.");
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  const [a, b] = (postExpand as jest.Mock).mock.calls.map((c) => c[0]);
  expect(b).not.toBe(a);
});

it('KIP\'s cheer is still under Reduce Motion', async () => {
  mockReduceMotion = true;
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockResolvedValue({ ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 50, stored: 0 });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-room').props.room.split(':')).toEqual(expect.arrayContaining(['cheer', 'MORE ROOM!', 'still']));
});

describe('the unlock moment and a screen reader', () => {
  let focus: jest.SpyInstance;
  let handle: jest.SpyInstance;
  beforeEach(() => {
    // The test renderer has no native views: each ref stands for itself, so the test sees which element got focus.
    handle = jest.spyOn(require('react-native') as typeof ReactNative, 'findNodeHandle').mockImplementation(((el: unknown) => el) as never);
    focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  });
  afterEach(() => { handle.mockRestore(); focus.mockRestore(); });
  const focused = () => focus.mock.calls.map(([el]) => (el as { props?: { testID?: string } }).props?.testID);

  it('takes focus to the card, hides the sizes list behind it on Android, and reads no "·"', async () => {
    const s = await open({ balance: 1600, checkIn: { level: 2 }, sleepLevel: 3, room: cosmeticsDTO({ tier: 2, cap: 60, version: 2 }) });
    expect(s.getByTestId('sizes-list').props.importantForAccessibility).toBeUndefined();
    (postExpand as jest.Mock).mockResolvedValue({ ...cosmeticsDTO({ tier: 3, cap: 90, version: 4 }), balance: 100, stored: 0 });
    await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
    expect(focused()).toEqual(['sizes-grown-title']);
    const list = s.getByTestId('sizes-list', { includeHiddenElements: true });
    expect([list.props.importantForAccessibility, list.props.accessibilityElementsHidden]).toEqual(['no-hide-descendants', true]);
    expect(s.getByTestId('sizes-grown-more').props.accessibilityLabel).toBe('One more row each side, 30 more pieces, 3 more effect slots, and a second window');
    for (const id of ['sizes-grown-more', 'sizes-row-name-3', 'sizes-row-pieces-3']) {
      expect(s.getByTestId(id, { includeHiddenElements: true }).props.accessibilityLabel).not.toMatch(/·|×/);
    }
  });
});
