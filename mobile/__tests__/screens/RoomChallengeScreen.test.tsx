import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { cheerEntry, enterChallenge, fetchChallenge } from '../../src/api/rooms';
import { loadCoins } from '../../src/lib/coins/coinsStore';
import { loadCosmetics } from '../../src/lib/room/cosmeticsStore';
import { loadRoomSocial } from '../../src/lib/room/giftsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { RoomChallengeScreen } from '../../src/screens/RoomChallengeScreen';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/rooms', () => ({ fetchChallenge: jest.fn(), enterChallenge: jest.fn(), cheerEntry: jest.fn() }));
// After an entry or a cheer the room, the coins and the room card's challenge are read again (T11T12-RELOAD).
jest.mock('../../src/lib/room/cosmeticsStore', () => ({ ...jest.requireActual('../../src/lib/room/cosmeticsStore'), loadCosmetics: jest.fn(async () => null) }));
jest.mock('../../src/lib/coins/coinsStore', () => ({ ...jest.requireActual('../../src/lib/coins/coinsStore'), loadCoins: jest.fn(async () => null) }));
jest.mock('../../src/lib/room/giftsStore', () => ({ ...jest.requireActual('../../src/lib/room/giftsStore'), loadRoomSocial: jest.fn(async () => undefined) }));
const mockNav = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  beforeRemove: null as null | ((e: { preventDefault: () => void }) => void),
  addListener: jest.fn((name: string, cb: (e: { preventDefault: () => void }) => void) => {
    if (name === 'beforeRemove') mockNav.beforeRemove = cb;
    return () => undefined;
  }),
};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

const THEME = { id: 'cosyAutumn' as const, tag: 'warm' as const, atLeast: 3, themePiece: 'lamp.harvest', trophy: 'corner.acorn' };
const ENTRY = { userId: 'b1', name: 'Maya', kipColour: 'lime', kipWorn: { head: null, face: null, neck: null, ears: null }, snapshot: { layout: starterLayout(), size: { n: 8, m: 8 } }, cheers: 2, cheeredByMe: false, mine: false };
const body = (over = {}) => ({ week: '2026-W44', theme: THEME, closesAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(), open: true, entry: null, entries: [ENTRY], results: null, ...over });
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNav.beforeRemove = null;
});
async function open(dto: unknown = body()) {
  (fetchChallenge as jest.Mock).mockResolvedValue(dto);
  const view = render(<RoomChallengeScreen />);
  await act(async () => undefined);
  return view;
}

it('shows the brief, the rewards, and the consent line above Start my entry (spec §10.4, controller ruling)', async () => {
  await open();
  // PageTitle draws in capitals; a screen reader gets the theme's own words (PF4-F14).
  expect(screen.getByTestId('challenge-title').props.accessibilityLabel).toBe('Cosy autumn');
  expect(screen.getByTestId('challenge-title')).toHaveTextContent('COSY AUTUMN');
  expect(screen.getByTestId('challenge-head').props.accessibilityLabel).toBe('Room challenge, Buddies only');
  expect(screen.getByTestId('challenge-brief')).toHaveTextContent('Use 3 or more warm pieces.');
  expect(screen.getByTestId('challenge-tags')).toHaveTextContent('1 buddy in · 3 days left · Ends Sunday 20:00');
  expect(screen.getByTestId('challenge-tags').props.accessibilityLabel).toBe('1 buddy in, 3 days left, Ends Sunday 20:00');
  expect(screen.getByTestId('challenge-reward-piece')).toHaveTextContent('Harvest lantern: this week only, in the coin shop for 80');
  expect(screen.getByTestId('challenge-reward-trophy')).toHaveTextContent('Golden acorn: the trophy for the most-cheered room, glows at night');
  // The consent line comes before the button, and the snapshot line after it.
  const sheet = screen.getByTestId('challenge-enter');
  const order = within(sheet).getAllByText(/.+/).map((t) => t.props.testID ?? t.props.children);
  expect(order[0]).toBe('challenge-consent');
  expect(screen.getByTestId('challenge-consent')).toHaveTextContent('Your buddies will see your entry: a snapshot of your room, including its size.');
  expect(screen.getByTestId('challenge-snapshot')).toHaveTextContent('Your entry is a snapshot of your room on Sunday. Build as usual until then.');
  expect(screen.queryByTestId('challenge-checklist')).toBeNull();

  (enterChallenge as jest.Mock).mockResolvedValue(body({ entry: { count: 2, meets: false, paid: false } }));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(enterChallenge).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('challenge-start')).toBeNull();
  expect(screen.getByTestId('challenge-checklist')).toHaveTextContent('Warm pieces · 2 of 3');
  expect(screen.getByTestId('challenge-checklist').props.accessibilityLabel).toBe('Warm pieces, 2 of 3');
  expect(screen.getByTestId('challenge-note')).toHaveTextContent('You entered');
  // The room, the coins and the room card's challenge are read again at once.
  expect([loadCosmetics, loadCoins, loadRoomSocial].map((f) => (f as jest.Mock).mock.calls.length)).toEqual([1, 1, 1]);
  expect(loadCoins).toHaveBeenCalledWith({ fresh: true });
  fireEvent.press(screen.getByTestId('challenge-build'));
  expect(mockNav.navigate).toHaveBeenCalledWith('DecorateRoom', { drawer: 'theme' });
});

it('says the +30 when the entry already meets the brief, in words a screen reader can say (PF4-F15)', async () => {
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await open();
  (enterChallenge as jest.Mock).mockResolvedValue(body({ entry: { count: 3, meets: true, paid: true } }));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(screen.getByTestId('challenge-note')).toHaveTextContent('You entered · +30 coins');
  expect(screen.getByTestId('challenge-note').props.accessibilityLabel).toBe('You entered. Plus 30 coins');
  expect(screen.getByTestId('challenge-entered').props.accessibilityLabel).toBe('You entered. Plus 30 coins');
  // Jest runs as iOS, where a live region says nothing, so it is announced.
  expect(say).toHaveBeenLastCalledWith('You entered. Plus 30 coins');
  say.mockRestore();
});

it('holds Close and back while the entry is on its way, then lets you leave (PF4-F16)', async () => {
  await open();
  const wait = deferred<unknown>();
  (enterChallenge as jest.Mock).mockReturnValue(wait.promise);
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  // A second tap in the same moment enters once.
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(enterChallenge).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('challenge-close').props.accessibilityState).toMatchObject({ disabled: true });
  const held = { preventDefault: jest.fn() };
  mockNav.beforeRemove!(held);
  expect(held.preventDefault).toHaveBeenCalled();
  await act(async () => { wait.resolve(body({ entry: { count: 2, meets: false, paid: false } })); });
  const free = { preventDefault: jest.fn() };
  mockNav.beforeRemove!(free);
  expect(free.preventDefault).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('challenge-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('an entry refused because the week closed or has no theme reads the server again and says so', async () => {
  await open();
  (enterChallenge as jest.Mock).mockRejectedValue(new ApiError(409, 'x', 'challenge_closed'));
  (fetchChallenge as jest.Mock).mockResolvedValue(body({ open: false }));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(fetchChallenge).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('challenge-start')).toBeNull();
  expect(screen.getByTestId('challenge-note')).toHaveTextContent("This week's challenge has closed.");
});

it('a failed entry keeps Start my entry with a line, and 503 says to come back in a minute', async () => {
  await open();
  (enterChallenge as jest.Mock).mockRejectedValue(new ApiError(503, 'x', 'try_later'));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(screen.getByTestId('challenge-note')).toHaveTextContent("Couldn't do that right now. Try again in a minute.");
  expect(screen.getByTestId('challenge-start').props.accessibilityState).toMatchObject({ disabled: false });
  (enterChallenge as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(screen.getByTestId('challenge-note')).toHaveTextContent("Couldn't start your entry just now.");
  // No answer: the entry may have landed, so the room, the coins and the challenge are read again.
  expect(fetchChallenge).toHaveBeenCalledTimes(2);
});

it('draws buddies\' entries neutral and cheers one once (rulings 10, 24)', async () => {
  (cheerEntry as jest.Mock).mockResolvedValue({ paid: true });
  await open();
  const room = screen.getByTestId('entry-room-b1');
  expect(room.props.living).toBeUndefined();
  expect(room.props.room).toMatch(/:fallback:/);
  expect(room.props.accessibilityLabel).toBe("Maya's entry");
  expect(room.props.tier).toBe(2);
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('2 cheers');
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b1')); });
  expect(cheerEntry).toHaveBeenCalledWith('b1');
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('3 cheers');
  expect(screen.getByTestId('entry-cheer-b1')).toHaveTextContent('Cheered');
  expect(screen.getByTestId('entry-cheer-b1').props.accessibilityState).toMatchObject({ disabled: true });
  expect(loadCoins).toHaveBeenCalledWith({ fresh: true });
  expect(loadCosmetics).toHaveBeenCalled();
});

it('never offers a cheer on your own entry, one already cheered, or after the close (ruling 10)', async () => {
  await open(body({ open: false, entries: [ENTRY, { ...ENTRY, userId: 'b2', name: 'Jo', cheeredByMe: true }, { ...ENTRY, userId: 'me', name: 'Sam', mine: true }] }));
  expect(screen.getByTestId('entry-cheer-b1').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('entry-cheer-b2')).toHaveTextContent('Cheered');
  expect(screen.queryByTestId('entry-cheer-me')).toBeNull();
  expect(screen.getByTestId('entry-room-me')).toBeTruthy();
});

it('a cheer answered 409 shows as cheered or closed, a 503 keeps the cheer to try again, a 404 reads the list again', async () => {
  await open(body({ entries: [ENTRY, { ...ENTRY, userId: 'b2', name: 'Jo' }] }));
  (cheerEntry as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'already_cheered'));
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b1')); });
  expect(screen.getByTestId('entry-cheer-b1')).toHaveTextContent('Cheered');
  // Cheered elsewhere: the count the server sent already holds it.
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('2 cheers');
  // A buddy whose own week closed first (EntryDTO has no closed flag): the 409 closes that entry only.
  (cheerEntry as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'challenge_closed'));
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b2')); });
  expect(screen.getByTestId('entry-cheer-b2')).toHaveTextContent('Entry closed');
  expect(screen.getByTestId('entry-cheer-b2').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('challenge-note')).toHaveTextContent("Jo's entry has closed.");
  expect(screen.getByTestId('challenge-start').props.accessibilityState).toMatchObject({ disabled: false });
});

it('a cheer that failed for a moment stays offered with a line; one for an entry that is gone reads the list again', async () => {
  await open();
  (cheerEntry as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'x', 'try_later'));
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b1')); });
  expect(screen.getByTestId('challenge-note')).toHaveTextContent("Couldn't do that right now. Try again in a minute.");
  expect(screen.getByTestId('entry-cheer-b1').props.accessibilityState).toMatchObject({ disabled: false });
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('2 cheers');
  (cheerEntry as jest.Mock).mockRejectedValueOnce(new ApiError(404, 'x', 'not_found'));
  (fetchChallenge as jest.Mock).mockResolvedValue(body({ entries: [] }));
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b1')); });
  expect(screen.queryByTestId('entry-room-b1')).toBeNull();
  expect(screen.getByTestId('challenge-note')).toHaveTextContent('That entry is no longer there.');
});

it('shows last week\'s results in your circle by name, and the unranked case (ruling 28, PF4-F18)', async () => {
  const view = await open(body({ results: { week: '2026-W43', themeId: 'tidyDesk', ranked: true, winners: ['Maya'], entries: [{ name: 'Maya', cheers: 4, mine: false }, { name: 'Sam', cheers: 2, mine: true }], you: { entered: true, won: false } } }));
  expect(screen.getByTestId('results-won')).toHaveTextContent("Maya's room won");
  expect(screen.getByTestId('results-glow')).toHaveTextContent('The trophy glows on their floor at night');
  expect(screen.getByTestId('results-row-0')).toHaveTextContent('Maya · 4 cheers');
  expect(screen.getByTestId('results-row-0').props.accessibilityLabel).toBe('Maya, 4 cheers');
  expect(screen.getByTestId('results-row-1')).toHaveTextContent('Sam · 2 cheers');
  expect(screen.getByTestId('results-you')).toHaveTextContent('You entered');
  view.unmount();
  await open(body({ theme: null, closesAt: null, open: false, entries: [], results: { week: '2026-W43', themeId: 'tidyDesk', ranked: false, winners: [], entries: [], you: { entered: true, won: false } } }));
  expect(screen.getByTestId('results-unranked')).toHaveTextContent(/no ranking this week/);
  expect(screen.getByTestId('challenge-none')).toHaveTextContent("There's no room challenge this week.");
  expect(screen.queryByTestId('challenge-start')).toBeNull();
});

it('your own win reads as yours, with any tied buddy named after it', async () => {
  await open(body({ results: { week: '2026-W43', themeId: 'tidyDesk', ranked: true, winners: ['Sam', 'Maya'], entries: [{ name: 'Sam', cheers: 4, mine: true }, { name: 'Maya', cheers: 4, mine: false }], you: { entered: true, won: true } } }));
  expect(screen.getByTestId('results-mine')).toHaveTextContent('Your room won! The trophy is in your inventory.');
  expect(screen.getAllByTestId('results-won').map((t) => t.props.children)).toEqual(["Maya's room won"]);
});

it('a theme this build has no words for reads neutral, never as no challenge', async () => {
  await open(body({ theme: { ...THEME, id: 'springClean' } }));
  expect(screen.getByTestId('challenge-title').props.accessibilityLabel).toBe("This week's theme");
  expect(screen.getByTestId('challenge-start')).toBeTruthy();
});

it('a failed read says so with Try again, and focus lands on the title once it loads', async () => {
  const handle = jest.spyOn(require('react-native'), 'findNodeHandle').mockImplementation(((el: unknown) => el) as never);
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  (fetchChallenge as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<RoomChallengeScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('challenge-failed')).toHaveTextContent(/^Couldn't load the room challenge just now\./);
  // The way out is there on a failure too.
  expect(screen.getByTestId('challenge-close')).toBeTruthy();
  (fetchChallenge as jest.Mock).mockResolvedValue(body());
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-retry')); });
  expect(screen.getByTestId('challenge-title')).toBeTruthy();
  expect(focus.mock.calls.map(([el]) => (el as unknown as { props?: { testID?: string } }).props?.testID)).toEqual(['challenge-title']);
  handle.mockRestore();
  focus.mockRestore();
});
