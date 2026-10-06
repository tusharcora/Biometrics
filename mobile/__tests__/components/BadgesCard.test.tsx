import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { fetchAchievements, type AchievementFamily } from '../../src/api/achievements';
import { BadgesCard } from '../../src/components/achievements/BadgesCard';
import { resetAchievements } from '../../src/lib/achievementsStore';
import { COLORS } from '../../src/theme';

jest.mock('../../src/api/achievements');
const load = fetchAchievements as jest.Mock;
const FAMILIES: AchievementFamily[] = ['SLEEP_GOAL', 'STEADY_BEDTIME', 'STEP_GOAL', 'CHECK_IN', 'BEST_RECOVERY_WEEK', 'EVERY_DAY_LOGGED', 'STEADIEST_MONTH'];
const CANVAS = achievementsFixture({
  SLEEP_GOAL: { level: 2, current: 9, best: 11 },
  STEADY_BEDTIME: { level: 3, current: 15 },
  STEP_GOAL: { level: 1, current: 5 },
  CHECK_IN: { level: 2, current: 16 },
  BEST_RECOVERY_WEEK: { level: 1, current: 1 },
});

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievements();
});

it('shows the seven badges at their levels, the count out of 35 and the family closest to its next level', async () => {
  load.mockResolvedValue(CANVAS);
  const onSeeAll = jest.fn();
  const onOpen = jest.fn();
  render(withCharacter(<BadgesCard onSeeAll={onSeeAll} onOpen={onOpen} />));

  expect(await screen.findByTestId('badges-count')).toHaveTextContent('BADGES · 9 OF 35');
  for (const f of FAMILIES) expect(screen.getByTestId(`badges-card-${f}`)).toBeTruthy();
  expect(screen.getByTestId('badges-card-SLEEP_GOAL-icon').props.accessibilityLabel).toBe('Sleep goal streak, level II, Silver');
  expect(screen.getByTestId('badges-card-SLEEP_GOAL-label')).toHaveStyle({ color: COLORS.light.foreground });
  expect(screen.getByTestId('badges-card-EVERY_DAY_LOGGED-label')).toHaveStyle({ color: COLORS.light.muted });
  expect(screen.getByTestId('badges-next-up')).toHaveTextContent('Next up: Step goal streak II');
  expect(screen.getByTestId('badges-next-up-count')).toHaveTextContent('5 / 7 days');
  expect(screen.getByTestId('badges-next-up-bar')).toHaveStyle({ width: '71%', backgroundColor: '#CBD5E1' });

  fireEvent.press(screen.getByTestId('badges-see-all'));
  expect(onSeeAll).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('badges-card-CHECK_IN'));
  expect(onOpen).toHaveBeenCalledWith('CHECK_IN');
});

it('has no next-up row when every family is at the top level', async () => {
  load.mockResolvedValue(achievementsFixture(Object.fromEntries(FAMILIES.map((f) => [f, { level: 5 }])) as Partial<Record<AchievementFamily, { level: number }>>));
  render(withCharacter(<BadgesCard onSeeAll={jest.fn()} onOpen={jest.fn()} />));
  expect(await screen.findByTestId('badges-count')).toHaveTextContent('BADGES · 35 OF 35');
  expect(screen.queryByTestId('badges-next-up')).toBeNull();
});

it('stays hidden against a backend without badges (404) and on an error', async () => {
  load.mockResolvedValue(null);
  const first = render(withCharacter(<BadgesCard onSeeAll={jest.fn()} onOpen={jest.fn()} />));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.queryByTestId('badges-card')).toBeNull();
  first.unmount();

  resetAchievements();
  load.mockRejectedValue(new Error('offline'));
  render(withCharacter(<BadgesCard onSeeAll={jest.fn()} onOpen={jest.fn()} />));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await act(async () => {});
  expect(screen.queryByTestId('badges-card')).toBeNull();
});
