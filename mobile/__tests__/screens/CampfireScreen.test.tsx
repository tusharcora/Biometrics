import React from 'react';
import { AccessibilityInfo, TextInput } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { clearCampNote, fetchCamp, saveCampNote, sayGoodnight, undoGoodnight, type Camp, type CampMember } from '../../src/api/social';
import { refreshSocial } from '../../src/lib/socialStore';
import { chromeBottom, fireBox, PEEK_RESERVE, seatBoxes, type Box } from '../../src/components/social/campSceneGeometry';
import { CampfireScreen } from '../../src/screens/CampfireScreen';

jest.mock('../../src/api/social', () => ({
  ...jest.requireActual('../../src/api/social'),
  fetchCamp: jest.fn(),
  saveCampNote: jest.fn(),
  clearCampNote: jest.fn(),
  sayGoodnight: jest.fn(),
  undoGoodnight: jest.fn(),
}));
jest.mock('../../src/lib/socialStore', () => ({ refreshSocial: jest.fn() }));
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  // Runs on mount like a first focus; mockRefocus() runs the latest callback again, as a later focus would.
  useFocusEffect: (cb: () => void) => { mockFocus.current = cb; const React = require('react'); React.useEffect(cb, []); },
}));
const mockFocus: { current: (() => void) | null } = { current: null };
const mockRefocus = () => mockFocus.current?.();
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = () => render(<SafeAreaProvider initialMetrics={metrics}><CampfireScreen /></SafeAreaProvider>);
const person = (id: string) => ({ id, handle: id, displayName: id.toUpperCase(), coachId: 'mochi' });
const member = (id: string, over: Partial<CampMember> = {}): CampMember => ({ person: person(id), mine: false, asleep: false, asleepSince: null, onTime: null, note: null, ...over });
const camp = (over: Partial<Camp> = {}): Camp => ({
  night: true,
  members: [
    member('me', { mine: true }),
    member('sam', { asleep: true, asleepSince: '2026-10-08T05:15:00.000Z', onTime: true, note: 'on time tonight' }),
    member('ben', { note: 'bed soon' }),
  ],
  fire: { lit: 3, of: 5, segments: 3 },
  nightsLitThisWeek: 2,
  goodnight: null,
  goodnightOpen: true,
  goodnightOpensAt: '20:00',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

it('draws the night camp: moon, bubbles over coaches, my add-note bubble, asleep coaches with z z, the lit fire and the panel', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  expect(await screen.findByTestId('camp-scene-night')).toBeTruthy();
  expect(screen.getByTestId('camp-moon')).toBeTruthy();
  expect(screen.getByTestId('camp-fire-lit')).toBeTruthy();
  expect(screen.getByTestId('camp-bubble-sam')).toHaveTextContent('on time tonight');
  expect(screen.getByTestId('camp-bubble-add')).toHaveTextContent('+ ADD A NOTE');
  expect(screen.getByTestId('camp-zz-sam')).toHaveTextContent('zz');
  expect(screen.queryByTestId('camp-zz-ben')).toBeNull();
  expect(screen.getByTestId('camp-headline')).toHaveTextContent('1 asleep · 2 by the fire');
  expect(screen.getByTestId('camp-fire-count')).toHaveTextContent('3/5');
  expect(screen.getByTestId('camp-fire-line')).toHaveTextContent('2 more on time lights it fully');
  expect(screen.getByTestId('camp-fire-segment-2')).toHaveStyle({ backgroundColor: '#F97316' });
  expect(screen.getByTestId('camp-fire-segment-3')).toHaveStyle({ backgroundColor: '#2E323B' });
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Lit 2 nights');
  // 12-hour times on the Campfire.
  expect(screen.getByTestId('camp-who-sam')).toHaveTextContent(/SAM asleep since \d{1,2}:\d{2} (AM|PM) · on time/);
  expect(screen.getByTestId('camp-who-ben')).toHaveTextContent('BEN awake · bed soon');
  expect(screen.getByTestId('camp-who-me')).toHaveTextContent('You awake');
  expect(screen.getByTestId('camp-goodnight-say')).toBeTruthy();
  expect(screen.queryByTestId('camp-more')).toBeNull();
});

it("a long note is one truncated line in the bubble and the whole note in Who's here", async () => {
  const long = 'heading to bed early, big race at dawn!!'; // 40 code points
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ members: [member('me', { mine: true }), member('ben', { note: long })] }));
  renderScreen();
  expect(await screen.findByTestId('camp-bubble-ben')).toHaveProp('numberOfLines', 1);
  expect(screen.getByTestId('camp-who-status-ben')).toHaveTextContent(`awake · ${long}`);
  expect(screen.getByTestId('camp-who-status-ben').props.numberOfLines).toBeUndefined();
});

it("an asleep member keeps their whole note in Who's here (their bubble is cut to a line)", async () => {
  const long = 'bed soon, night all, big race at dawn!!!'; // 40 code points
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ members: [member('me', { mine: true }), member('sam', { asleep: true, asleepSince: '2026-10-08T05:15:00.000Z', onTime: true, note: long })] }));
  renderScreen();
  expect(await screen.findByTestId('camp-bubble-sam')).toHaveProp('numberOfLines', 1);
  expect(screen.getByTestId('camp-who-status-sam')).toHaveTextContent(new RegExp(`^asleep since \\d{1,2}:\\d{2} (AM|PM) · on time · ${long}$`));
  expect(screen.getByTestId('camp-who-status-sam').props.numberOfLines).toBeUndefined();
});

it('by day: sky, no moon, unlit logs, and goodnight waits for my own opening time', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ night: false, goodnightOpen: false, goodnightOpensAt: '20:00' }));
  renderScreen();
  expect(await screen.findByTestId('camp-scene-day')).toBeTruthy();
  expect(screen.queryByTestId('camp-moon')).toBeNull();
  expect(screen.getByTestId('camp-fire-unlit')).toBeTruthy();
  expect(screen.getByTestId('camp-fire-count')).toHaveTextContent('Out');
  expect(screen.queryByTestId('camp-fire-line')).toBeNull();
  expect(screen.getByTestId('camp-headline')).toHaveTextContent('2 awake · 1 asleep');
  expect(screen.getByTestId('camp-goodnight-later')).toHaveTextContent('You can say goodnight from 8:00 PM');
  expect(screen.queryByTestId('camp-goodnight-say')).toBeNull();
});

it('an early goal opens goodnight before the night scene: 17:30 is still day, yet I can say it', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ night: false, goodnightOpen: true, goodnightOpensAt: '17:00' }));
  renderScreen();
  expect(await screen.findByTestId('camp-scene-day')).toBeTruthy();
  expect(screen.getByTestId('camp-goodnight-say')).toBeTruthy();
  expect(screen.queryByTestId('camp-goodnight-later')).toBeNull();
});

it('at 19:30 with no goal the scene is night but goodnight waits for 8:00 PM', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ night: true, goodnightOpen: false, goodnightOpensAt: '20:00' }));
  renderScreen();
  expect(await screen.findByTestId('camp-scene-night')).toBeTruthy();
  expect(screen.getByTestId('camp-goodnight-later')).toHaveTextContent('You can say goodnight from 8:00 PM');
  expect(screen.queryByTestId('camp-goodnight-say')).toBeNull();
});

it('seats eight coaches in the ring with no overlap, below the top chrome and above the Peek panel, on every phone size', () => {
  const overlaps = (a: Box, b: Box) =>
    a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  for (const width of [375, 390, 393, 402, 414, 428, 430]) {
    for (const height of [667, 736, 812, 844, 852, 874, 896, 926, 932]) {
      for (const inset of [20, 47, 59]) {
        const seats = seatBoxes(width, height, inset);
        const fire = fireBox(width, height, inset);
        expect(seats).toHaveLength(8);
        seats.forEach((a, i) => {
          expect(a.left).toBeGreaterThanOrEqual(0);
          expect(a.left + a.width).toBeLessThanOrEqual(width);
          // A seat's box starts at its bubble: no bubble or coach under the pills, kicker or headline.
          expect(a.top).toBeGreaterThanOrEqual(chromeBottom(inset));
          expect(a.top + a.height).toBeLessThanOrEqual(height - PEEK_RESERVE); // above the Peek panel
          expect(overlaps(a, fire)).toBe(false);
          for (const b of seats.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
        });
      }
    }
  }
});

it('the chrome clearance is real: a taller top inset pushes the ring down, and a too-short screen would break it', () => {
  // 667 with a 20-pt inset leaves 60 px between the chrome and the seats; a 140-pt inset leaves none.
  expect(seatBoxes(375, 667, 20)[4]!.top - chromeBottom(20)).toBeGreaterThan(0);
  const deep = seatBoxes(375, 667, 140);
  expect(Math.min(...deep.map((s) => s.top))).toBeGreaterThanOrEqual(chromeBottom(140));
  // ...which squeezes the ring past the Peek panel: the check above is what keeps this from happening on real phones.
  expect(Math.max(...deep.map((s) => s.top + s.height))).toBeGreaterThan(667 - PEEK_RESERVE);
});

it('shares a note with a live count, refuses one over 40, and clears mine', async () => {
  (fetchCamp as jest.Mock).mockResolvedValueOnce(camp()).mockResolvedValue(camp({ members: [member('me', { mine: true, note: 'night all' })] }));
  (saveCampNote as jest.Mock).mockResolvedValue({ note: { text: 'night all', createdAt: '', expiresAt: '' } });
  (clearCampNote as jest.Mock).mockResolvedValue(undefined);
  renderScreen();
  await screen.findByTestId('camp-note-input');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(screen.getByTestId('camp-note-input'), 'x'.repeat(41));
  // The ring counts what's left; its label says what's used.
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('-1');
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '41 of 40 characters');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(screen.getByTestId('camp-note-input'), ' night all ');
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('31');
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '9 of 40 characters');
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-share')));
  expect(saveCampNote).toHaveBeenCalledWith(' night all ');
  expect(refreshSocial).toHaveBeenCalled();
  expect(await screen.findByTestId('camp-bubble-me')).toHaveTextContent('night all');
  // Live: Edit note and Clear instead of the composer; Edit puts the note back in the draft.
  expect(screen.queryByTestId('camp-note-input')).toBeNull();
  expect(screen.getByTestId('camp-note-live')).toHaveTextContent('Live');
  fireEvent.press(screen.getByTestId('camp-note-edit'));
  expect(screen.getByTestId('camp-note-input')).toHaveProp('value', 'night all');
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-clear')));
  expect(clearCampNote).toHaveBeenCalledTimes(1);
});

it('Share counts code points: exactly 40 enables it, whitespace alone never does, an emoji is one', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  const input = await screen.findByTestId('camp-note-input');
  fireEvent.changeText(input, 'x'.repeat(40));
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '40 of 40 characters');
  expect(screen.getByTestId('camp-note-share')).not.toBeDisabled();
  fireEvent.changeText(input, '   \n\t ');
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '0 of 40 characters');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(input, '🔥🌙 night');
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '8 of 40 characters');
  fireEvent.changeText(input, `${'x'.repeat(38)}🔥🌙`); // 40 code points, 42 UTF-16 units
  expect(screen.getByTestId('camp-note-count')).toHaveProp('accessibilityLabel', '40 of 40 characters');
  expect(screen.getByTestId('camp-note-share')).not.toBeDisabled();
});

it('a double tap on Share sends once; the draft empties as it is sent', async () => {
  let resolve!: (v: unknown) => void;
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  (saveCampNote as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
  renderScreen();
  fireEvent.changeText(await screen.findByTestId('camp-note-input'), 'night all');
  act(() => {
    fireEvent.press(screen.getByTestId('camp-note-share'));
    fireEvent.press(screen.getByTestId('camp-note-share'));
  });
  expect(screen.getByTestId('camp-note-input')).toHaveProp('value', '');
  await act(async () => resolve({ note: { text: 'night all', createdAt: '', expiresAt: '' } }));
  expect(saveCampNote).toHaveBeenCalledTimes(1);
  expect(saveCampNote).toHaveBeenCalledWith('night all');
});

it('offers Clear from the share answer even when the re-read after sharing fails', async () => {
  (fetchCamp as jest.Mock).mockResolvedValueOnce(camp()).mockRejectedValue(new Error('offline'));
  (saveCampNote as jest.Mock).mockResolvedValue({ note: { text: 'night all', createdAt: '', expiresAt: '' } });
  (clearCampNote as jest.Mock).mockResolvedValue(undefined);
  renderScreen();
  fireEvent.changeText(await screen.findByTestId('camp-note-input'), 'night all');
  expect(screen.queryByTestId('camp-note-clear')).toBeNull();
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-share')));
  expect(fetchCamp).toHaveBeenCalledTimes(2);
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-clear')));
  expect(clearCampNote).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('camp-note-clear')).toBeNull();
});

it('a refocus re-reads the camp; if that read fails, buddies keep their seats but not their notes until a good read', async () => {
  (fetchCamp as jest.Mock).mockResolvedValueOnce(camp()).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(camp());
  renderScreen();
  expect(await screen.findByTestId('camp-bubble-sam')).toHaveTextContent('on time tonight');
  await act(async () => mockRefocus());
  expect(fetchCamp).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('camp-coach-sam')).toBeTruthy();
  expect(screen.queryByTestId('camp-bubble-sam')).toBeNull();
  expect(screen.queryByTestId('camp-bubble-ben')).toBeNull();
  expect(screen.getByTestId('camp-who-status-ben')).toHaveTextContent(/^awake$/);
  await act(async () => mockRefocus());
  expect(screen.getByTestId('camp-bubble-sam')).toHaveTextContent('on time tonight');
});

it('an older read that lands after a newer one never overwrites it', async () => {
  let resolveOld!: (v: Camp) => void;
  (fetchCamp as jest.Mock)
    .mockReturnValueOnce(new Promise((r) => { resolveOld = r; }))
    .mockResolvedValueOnce(camp({ nightsLitThisWeek: 4 }));
  renderScreen();
  await act(async () => mockRefocus());
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Lit 4 nights');
  await act(async () => resolveOld(camp({ nightsLitThisWeek: 1 })));
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Lit 4 nights');
});

it("shows the server's reason when a note is refused, keeping the draft", async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  (saveCampNote as jest.Mock).mockRejectedValue(new ApiError(429, 'x', 'rate_limited'));
  renderScreen();
  fireEvent.changeText(await screen.findByTestId('camp-note-input'), 'hello');
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-share')));
  expect(screen.getByTestId('camp-message')).toHaveTextContent('Too many tries. Please try again later.');
  expect(screen.getByTestId('camp-note-input')).toHaveProp('value', 'hello');
});

it('says goodnight, then offers Undo while it is fresh', async () => {
  const goodnight = { localDate: '2026-10-07', at: '2026-10-08T05:30:00.000Z', onTime: true, undoUntil: new Date(Date.now() + 600_000).toISOString() };
  (fetchCamp as jest.Mock).mockResolvedValueOnce(camp()).mockResolvedValue(camp({ goodnight }));
  (sayGoodnight as jest.Mock).mockResolvedValue({ goodnight });
  (undoGoodnight as jest.Mock).mockResolvedValue(undefined);
  renderScreen();
  // Found outside act: inside it, the load's re-render would wait for act to end and findBy would never see it.
  const say = await screen.findByTestId('camp-goodnight-say');
  await act(async () => fireEvent.press(say));
  expect(sayGoodnight).toHaveBeenCalledTimes(1);
  expect(await screen.findByTestId('camp-goodnight-said')).toHaveTextContent('Goodnight said, on time');
  expect(refreshSocial).toHaveBeenCalled();
  (refreshSocial as jest.Mock).mockClear();
  await act(async () => fireEvent.press(screen.getByTestId('camp-goodnight-undo')));
  expect(undoGoodnight).toHaveBeenCalledTimes(1);
  expect(refreshSocial).toHaveBeenCalledTimes(1);
});

it("a buddy's coach opens their week and mine does not navigate; +N past eight; Message camp opens Buddies; back goes back", async () => {
  const many = [member('me', { mine: true }), ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id) => member(id))];
  (fetchCamp as jest.Mock).mockResolvedValue(camp({ members: many }));
  renderScreen();
  fireEvent.press(await screen.findByTestId('camp-coach-a'));
  expect(mockNavigate).toHaveBeenLastCalledWith('BuddyWeek', { buddyId: 'a' });
  mockNavigate.mockClear();
  fireEvent.press(screen.getByTestId('camp-coach-me'));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByTestId('camp-more')).toHaveTextContent('+2 here');
  expect(screen.getByTestId('camp-more')).toHaveProp('accessibilityLabel', '2 more at the camp');
  expect(screen.queryByTestId('camp-coach-h')).toBeNull();
  expect(screen.getByTestId('camp-who-i')).toBeTruthy();
  fireEvent.press(screen.getByTestId('camp-message-camp'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Buddies');
  fireEvent.press(screen.getByTestId('camp-back'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('an older server says the camp is not open yet; a failure offers a retry', async () => {
  (fetchCamp as jest.Mock).mockResolvedValueOnce(null);
  const { unmount } = renderScreen();
  expect(await screen.findByTestId('camp-unavailable')).toHaveTextContent(/isn't open yet/);
  unmount();
  (fetchCamp as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(camp());
  renderScreen();
  expect(await screen.findByTestId('camp-error')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByTestId('camp-retry')));
  expect(await screen.findByTestId('campfire')).toBeTruthy();
});

it('names the moon, the fire, the seats, the composer and the fire strength for screen readers', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  expect(await screen.findByTestId('camp-moon')).toHaveProp('accessibilityLabel', 'The moon is up');
  expect(screen.getByTestId('camp-fire-lit')).toHaveProp('accessibilityLabel', 'The fire is lit');
  expect(screen.getByTestId('camp-coach-sam')).toHaveProp('accessibilityRole', 'button');
  expect(screen.getByTestId('camp-coach-sam')).toHaveProp('accessibilityLabel', 'SAM, asleep');
  expect(screen.getByTestId('camp-coach-me')).toHaveProp('accessibilityLabel', 'You. Write your camp note');
  expect(screen.getByTestId('camp-note-input')).toHaveProp('accessibilityLabel', 'Your camp note');
  expect(screen.getByTestId('camp-note-share')).toHaveProp('accessibilityRole', 'button');
  expect(screen.getByTestId('camp-fire-strength')).toHaveProp('accessibilityValue', { min: 0, max: 5, now: 3 });
});

const handle = () => screen.getByTestId('camp-panel-handle');

it('starts at Peek; the handle steps Peek → Half → Full → Peek', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  await screen.findByTestId('campfire');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, peek');
  expect(handle()).toHaveProp('accessibilityHint', 'Shows more');
  // Every stop's content is in the one scroll view, whatever the stop.
  expect(screen.getByTestId('camp-panel-scroll')).toHaveProp('scrollEnabled', false);
  expect(screen.getByTestId('camp-note-input')).toBeTruthy();
  expect(screen.getByTestId('camp-message-camp')).toBeTruthy();
  fireEvent.press(handle());
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, half open');
  fireEvent.press(handle());
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, fully open');
  expect(handle()).toHaveProp('accessibilityHint', 'Shows less');
  expect(screen.getByTestId('camp-panel-scroll')).toHaveProp('scrollEnabled', true);
  fireEvent.press(handle());
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, peek');
});

it('tapping my coach opens Half and focuses the note input', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  await screen.findByTestId('camp-coach-me');
  const focus = screen.UNSAFE_getByType(TextInput).instance.focus as jest.Mock;
  focus.mockClear();
  fireEvent.press(screen.getByTestId('camp-coach-me'));
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, half open');
  expect(focus).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('the handle is adjustable: increment goes up a stop, decrement down, stopping at either end', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  await screen.findByTestId('campfire');
  expect(handle()).toHaveProp('accessibilityRole', 'adjustable');
  const act11y = (actionName: string) => fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName } });
  act11y('decrement');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, peek');
  act11y('increment');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, half open');
  act11y('increment');
  act11y('increment');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, fully open');
  act11y('decrement');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, half open');
});

it('a quick-pick chip fills the draft', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  fireEvent.press(await screen.findByTestId('camp-chip-1'));
  expect(screen.getByTestId('camp-note-input')).toHaveProp('value', 'early start tmrw');
  expect(screen.getByTestId('camp-note-share')).not.toBeDisabled();
});

it('with a screen reader on, starts at Half and the panel scrolls at every stop', async () => {
  const reader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  await screen.findByTestId('campfire');
  expect(handle()).toHaveProp('accessibilityLabel', 'Camp details, half open');
  expect(screen.getByTestId('camp-panel-scroll')).toHaveProp('scrollEnabled', true);
  fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(screen.getByTestId('camp-panel-scroll')).toHaveProp('scrollEnabled', true);
  reader.mockRestore();
});
