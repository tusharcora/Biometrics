import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { ApiError } from '../../src/api/client';
import { fetchRecap, markRecapOpened, type Recap } from '../../src/api/recaps';
import { RecapScreen } from '../../src/screens/RecapScreen';

jest.mock('../../src/api/recaps');
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockCanGoBack = true;
let mockParams: { id: string } = { id: 'r-month' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => mockCanGoBack }),
  useRoute: () => ({ params: mockParams }),
}));

const load = fetchRecap as jest.Mock;
const opened = markRecapOpened as jest.Mock;
const BASE = { personaId: 'mochi', builtAt: '2026-10-01T09:00:00.000Z', openedAt: null, sleepGoalMinutes: 480, lineSource: 'ai' as const, rebuiltAt: null };
const MONTH: Recap = {
  ...BASE, id: 'r-month', kind: 'MONTH', periodStart: '2026-09-01', periodEnd: '2026-09-30', line: 'Six nights in a row on goal, lovely.', story: null,
  stats: { nightsWithData: 25, avgSleepMinutes: 455, longestOnGoalStreak: 6, comparison: { avgSleepDelta: 18, avgRecoveryDelta: -4 }, milestones: { streak: { nights: 6 } } },
};
const WEEK: Recap = {
  ...BASE, id: 'r-week', kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A steady week.', story: 'You hit your goal on 5 nights this week.',
  stats: { nightsWithData: 6, weekStrip: [] },
};
const GONE = () => new ApiError(404, 'Request to /me/recaps/x failed with 404', 'not_found');

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'r-month' };
  mockCanGoBack = true;
  load.mockResolvedValue(MONTH);
  opened.mockResolvedValue(undefined);
});

it('shows a month with its coach, line, milestones and only the comparisons present', async () => {
  render(withCharacter(<RecapScreen />));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('September with Mochi');
  expect(screen.getByTestId('recap-line')).toHaveTextContent('Six nights in a row on goal, lovely.');
  expect(screen.getByTestId('recap-milestone-streak')).toHaveTextContent('6 nights on goal in a row');
  expect(screen.getByText('Compared with last month')).toBeTruthy();
  expect(screen.getByTestId('recap-compare-avgSleep')).toHaveTextContent('↑18m more sleep a night');
  expect(screen.getByTestId('recap-compare-recovery')).toHaveTextContent('↓Recovery 4 points lower');
  expect(screen.queryByTestId('recap-compare-spread')).toBeNull();
  fireEvent.press(screen.getByTestId('recap-make-share'));
  expect(mockNavigate).toHaveBeenCalledWith('RecapBuilder', { id: 'r-month', format: 'card' });
});

it('leaves out milestones and the comparison when the month has none', async () => {
  load.mockResolvedValue({ ...MONTH, stats: { nightsWithData: 3 } });
  render(withCharacter(<RecapScreen />));
  await screen.findByTestId('recap-title');
  expect(screen.queryByTestId('recap-milestones')).toBeNull();
  expect(screen.queryByTestId('recap-compare')).toBeNull();
  expect(screen.queryByText('Compared with last month')).toBeNull();
});

it('shows a week as its story card with the paragraph under it', async () => {
  mockParams = { id: 'r-week' };
  load.mockResolvedValue(WEEK);
  render(withCharacter(<RecapScreen />));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('Your week with Mochi');
  expect(screen.getByTestId('recap-story-preview')).toBeTruthy();
  expect(screen.getByTestId('recap-story-text')).toHaveTextContent('You hit your goal on 5 nights this week.');
  fireEvent.press(screen.getByTestId('recap-make-share'));
  expect(mockNavigate).toHaveBeenCalledWith('RecapBuilder', { id: 'r-week', format: 'story' });
});

it("names the recap's own coach after a coach switch, not the current one (ruling S6)", async () => {
  load.mockResolvedValue({ ...MONTH, personaId: 'luna' });
  const { unmount } = render(withCharacter(<RecapScreen />, { characterId: 'mochi' }));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('September with Luna');
  unmount();

  mockParams = { id: 'r-week' };
  load.mockResolvedValue({ ...WEEK, personaId: 'luna' });
  render(withCharacter(<RecapScreen />, { characterId: 'mochi' }));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('Your week with Luna');
  expect(screen.getByTestId('recap-story-title')).toHaveTextContent('How Luna saw my week');
});

it('falls back to the current coach when the recap has no coach we know', async () => {
  load.mockResolvedValue({ ...MONTH, personaId: null });
  render(withCharacter(<RecapScreen />, { characterId: 'boba' }));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('September with Boba');
});

it('marks the recap opened once, when it is shown', async () => {
  const { rerender } = render(withCharacter(<RecapScreen />));
  await screen.findByTestId('recap-title');
  await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
  expect(opened).toHaveBeenCalledWith('r-month');
  rerender(withCharacter(<RecapScreen />));
  await screen.findByTestId('recap-title');
  expect(opened).toHaveBeenCalledTimes(1);
});

it('keeps the recap on screen when marking it opened fails', async () => {
  opened.mockRejectedValue(new Error('offline'));
  render(withCharacter(<RecapScreen />));
  await screen.findByTestId('recap-title');
  await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('recap-title')).toHaveTextContent('September with Mochi');
  expect(screen.queryByTestId('recap-error')).toBeNull();
});

it("says a gone or someone else's recap isn't available, and never marks it opened (Review Focus 5)", async () => {
  load.mockRejectedValue(GONE());
  render(withCharacter(<RecapScreen />));
  expect(await screen.findByTestId('recap-missing')).toHaveTextContent("This recap isn't available.");
  expect(screen.queryByTestId('recap-loading')).toBeNull();
  expect(opened).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('recap-missing-back'));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

it('takes a missing recap opened with nothing behind it (a cold-start push) home', async () => {
  mockCanGoBack = false;
  load.mockRejectedValue(GONE());
  render(withCharacter(<RecapScreen />));
  fireEvent.press(await screen.findByTestId('recap-missing-back'));
  expect(mockGoBack).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('Tabs');
});

it('offers a retry after another failure', async () => {
  load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(MONTH);
  render(withCharacter(<RecapScreen />));
  fireEvent.press(await screen.findByTestId('recap-retry'));
  expect(await screen.findByTestId('recap-title')).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(2);
});

it('shows the new recap, never a stale one, when a push re-opens this screen with another id (T19 ruling)', async () => {
  let resolveMonth!: (r: Recap) => void;
  load.mockImplementation((id: string) => (id === 'r-month' ? new Promise<Recap>((r) => (resolveMonth = r)) : Promise.resolve(WEEK)));
  const { rerender } = render(withCharacter(<RecapScreen />));
  // The push lands while the first recap is still loading: same screen, new params.
  mockParams = { id: 'r-week' };
  rerender(withCharacter(<RecapScreen />));
  expect(await screen.findByTestId('recap-title')).toHaveTextContent('Your week with Mochi');
  // The first recap's answer arrives late and is dropped.
  await act(async () => resolveMonth(MONTH));
  expect(screen.getByTestId('recap-title')).toHaveTextContent('Your week with Mochi');
  await waitFor(() => expect(opened).toHaveBeenCalledWith('r-week'));
  expect(opened).not.toHaveBeenCalledWith('r-month');
});
