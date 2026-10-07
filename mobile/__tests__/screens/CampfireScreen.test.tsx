import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { clearCampNote, fetchCamp, saveCampNote, sayGoodnight, undoGoodnight, type Camp, type CampMember } from '../../src/api/social';
import { refreshSocial } from '../../src/lib/socialStore';
import { CampfireScreen, fireBox, SCENE_HEADER_HEIGHT, SCENE_HEIGHT, seatBoxes, type Box } from '../../src/screens/CampfireScreen';

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

it('draws the night camp: moon, bubbles over coaches, my dashed add-note bubble, asleep coaches with z z, the lit fire and the card', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  expect(await screen.findByTestId('camp-scene-night')).toBeTruthy();
  expect(screen.getByTestId('camp-moon')).toBeTruthy();
  expect(screen.getByTestId('camp-fire-lit')).toBeTruthy();
  expect(screen.getByTestId('camp-bubble-sam')).toHaveTextContent('on time tonight');
  expect(screen.getByTestId('camp-bubble-add')).toHaveTextContent('+ Add a note');
  expect(screen.getByTestId('camp-zz-sam')).toHaveTextContent('z z');
  expect(screen.getByTestId('camp-zz-ben')).not.toHaveTextContent('z z');
  expect(screen.getByTestId('camp-fire-line')).toHaveTextContent('3 of 5 in bed on time');
  expect(screen.getByTestId('camp-fire-segment-2')).toHaveStyle({ backgroundColor: '#F97316' });
  expect(screen.getByTestId('camp-fire-segment-3')).toHaveStyle({ backgroundColor: '#2E323B' });
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Nights lit this week: 2');
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

it('seats eight coaches around the fire with no overlap inside the 340-px scene, on every phone width', () => {
  const overlaps = (a: Box, b: Box) =>
    a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  expect(SCENE_HEIGHT).toBe(340);
  for (const width of [375, 390, 393, 430]) {
    const seats = seatBoxes(width);
    const fire = fireBox(width);
    expect(seats).toHaveLength(8);
    seats.forEach((a, i) => {
      expect(a.left).toBeGreaterThanOrEqual(0);
      expect(a.left + a.width).toBeLessThanOrEqual(width);
      expect(a.top).toBeGreaterThanOrEqual(SCENE_HEADER_HEIGHT); // below the back button and title
      expect(a.top + a.height).toBeLessThanOrEqual(SCENE_HEIGHT);
      expect(overlaps(a, fire)).toBe(false);
      for (const b of seats.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    });
  }
});

it('shares a note with a live count, refuses one over 40, and clears mine', async () => {
  (fetchCamp as jest.Mock).mockResolvedValueOnce(camp()).mockResolvedValue(camp({ members: [member('me', { mine: true, note: 'night all' })] }));
  (saveCampNote as jest.Mock).mockResolvedValue({ note: { text: 'night all', createdAt: '', expiresAt: '' } });
  (clearCampNote as jest.Mock).mockResolvedValue(undefined);
  renderScreen();
  await screen.findByTestId('camp-note-input');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(screen.getByTestId('camp-note-input'), 'x'.repeat(41));
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('41/40');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(screen.getByTestId('camp-note-input'), ' night all ');
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('9/40');
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-share')));
  expect(saveCampNote).toHaveBeenCalledWith(' night all ');
  expect(screen.getByTestId('camp-note-input')).toHaveProp('value', '');
  expect(refreshSocial).toHaveBeenCalled();
  expect(await screen.findByTestId('camp-bubble-me')).toHaveTextContent('night all');
  await act(async () => fireEvent.press(screen.getByTestId('camp-note-clear')));
  expect(clearCampNote).toHaveBeenCalledTimes(1);
});

it('Share counts code points: exactly 40 enables it, whitespace alone never does, an emoji is one', async () => {
  (fetchCamp as jest.Mock).mockResolvedValue(camp());
  renderScreen();
  const input = await screen.findByTestId('camp-note-input');
  fireEvent.changeText(input, 'x'.repeat(40));
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('40/40');
  expect(screen.getByTestId('camp-note-share')).not.toBeDisabled();
  fireEvent.changeText(input, '   \n\t ');
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('0/40');
  expect(screen.getByTestId('camp-note-share')).toBeDisabled();
  fireEvent.changeText(input, '🔥🌙 night');
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('8/40');
  fireEvent.changeText(input, `${'x'.repeat(38)}🔥🌙`); // 40 code points, 42 UTF-16 units
  expect(screen.getByTestId('camp-note-count')).toHaveTextContent('40/40');
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
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Nights lit this week: 4');
  await act(async () => resolveOld(camp({ nightsLitThisWeek: 1 })));
  expect(screen.getByTestId('camp-nights-lit')).toHaveTextContent('Nights lit this week: 4');
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
  expect(screen.getByTestId('camp-more')).toHaveTextContent('+2');
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
