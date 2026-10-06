import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { fetchAchievements, markCelebrated } from '../../src/api/achievements';
import { CelebrationHost } from '../../src/components/achievements/CelebrationHost';
import { resetAchievements } from '../../src/lib/achievementsStore';

jest.mock('../../src/api/achievements');
jest.mock('../../src/lib/recapCapture', () => ({ captureToPng: jest.fn(), saveImage: jest.fn(), shareImage: jest.fn() }));
const load = fetchAchievements as jest.Mock;
const post = markCelebrated as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievements();
  post.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('celebrates one family at a time, highest level first, and marks each family celebrated on close', async () => {
  load.mockResolvedValue(achievementsFixture({ SLEEP_GOAL: { level: 2 }, CHECK_IN: { level: 1 } }, {
    uncelebrated: [
      { id: 's1', family: 'SLEEP_GOAL', level: 1, value: 3, earnedOn: '2026-10-03' },
      { id: 's2', family: 'SLEEP_GOAL', level: 2, value: 7, earnedOn: '2026-10-07' },
      { id: 'c1', family: 'CHECK_IN', level: 1, value: 7, earnedOn: '2026-10-07' },
    ],
  }));
  render(withCharacter(<CelebrationHost />));

  expect(await screen.findByTestId('celebration-title')).toHaveTextContent('SLEEP GOAL STREAK II');
  fireEvent.press(screen.getByTestId('celebration-done'));
  expect(post).toHaveBeenCalledWith(['s1', 's2']);
  await waitFor(() => expect(screen.getByTestId('celebration-title')).toHaveTextContent('DAILY CHECK-IN I'));
  fireEvent.press(screen.getByTestId('celebration-done'));
  expect(post).toHaveBeenLastCalledWith(['c1']);
  await waitFor(() => expect(screen.queryByTestId('celebration-title')).toBeNull());
});

it('checks again when the app comes back to the foreground', async () => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (state: string) => void) => {
    listeners.push(cb);
    return { remove: jest.fn() };
  }) as never);
  load.mockResolvedValue(achievementsFixture());
  render(withCharacter(<CelebrationHost />));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('celebration-title')).toBeNull();

  load.mockResolvedValue(achievementsFixture({ STEP_GOAL: { level: 1 } }, { uncelebrated: [{ id: 'p1', family: 'STEP_GOAL', level: 1, value: 3, earnedOn: '2026-10-09' }] }));
  await act(async () => listeners.forEach((l) => l('active')));
  expect(await screen.findByTestId('celebration-title')).toHaveTextContent('STEP GOAL STREAK I');
});

it('shows nothing against a backend without badges (404)', async () => {
  load.mockResolvedValue(null);
  render(withCharacter(<CelebrationHost />));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.queryByTestId('celebration-screen')).toBeNull();
});
