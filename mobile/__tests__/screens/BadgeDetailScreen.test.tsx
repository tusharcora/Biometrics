import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { fetchAchievements } from '../../src/api/achievements';
import { resetAchievements } from '../../src/lib/achievementsStore';
import { BadgeDetailScreen } from '../../src/screens/BadgeDetailScreen';

jest.mock('../../src/api/achievements');
let mockParams: { family: string } = { family: 'SLEEP_GOAL' };
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  NavigationContext: require('react').createContext(undefined),
}));
const load = fetchAchievements as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievements();
});

it('shows the big badge, current and best, and the ladder of five levels', async () => {
  mockParams = { family: 'SLEEP_GOAL' };
  load.mockResolvedValue(achievementsFixture({
    SLEEP_GOAL: { level: 2, current: 9, best: 11, levels: [{ level: 1, value: 3, earnedOn: '2026-10-08' }, { level: 2, value: 7, earnedOn: '2026-10-12' }] },
  }));
  render(withCharacter(<BadgeDetailScreen />));
  expect(await screen.findByTestId('badge-detail-title')).toHaveTextContent('SLEEP GOAL STREAK');
  expect(screen.getByTestId('badge-detail-icon').props.accessibilityLabel).toBe('Sleep goal streak, level II, Silver');
  expect(screen.getByTestId('badge-detail-current')).toHaveTextContent('CURRENT STREAK9 nights');
  expect(screen.getByTestId('badge-detail-best')).toHaveTextContent('BEST STREAK11 nights');
  expect(screen.getByTestId('badge-detail-level-1')).toHaveTextContent('Level I · Bronze · 3 nights', { exact: false });
  expect(screen.getByTestId('badge-detail-level-1-sub')).toHaveTextContent('Earned Oct 8');
  expect(screen.getByTestId('badge-detail-level-1-tag')).toHaveTextContent('EARNED');
  expect(screen.getByTestId('badge-detail-level-3-sub')).toHaveTextContent('5 more nights in a row');
  expect(screen.getByTestId('badge-detail-level-3-tag')).toHaveTextContent('NEXT');
  expect(screen.getByTestId('badge-detail-level-3-icon').props.accessibilityLabel).toBe('Sleep goal streak, locked');
  expect(screen.getByTestId('badge-detail-level-5')).toHaveTextContent('Level V · Coach · 100 nights', { exact: false });
  expect(screen.getByTestId('badge-detail-level-5-sub')).toHaveTextContent('Locked');
  expect(screen.queryByTestId('badge-detail-level-5-tag')).toBeNull();
});

it('shows a monthly family as one month count', async () => {
  mockParams = { family: 'EVERY_DAY_LOGGED' };
  load.mockResolvedValue(achievementsFixture({ EVERY_DAY_LOGGED: { level: 1, current: 2, best: 2, levels: [{ level: 1, value: 1, earnedOn: '2026-10-31' }] } }));
  render(withCharacter(<BadgeDetailScreen />));
  expect(await screen.findByTestId('badge-detail-current')).toHaveTextContent('MONTHS SO FAR2 months');
  expect(screen.queryByTestId('badge-detail-best')).toBeNull();
  expect(screen.getByTestId('badge-detail-level-2-sub')).toHaveTextContent('1 more month');
});

it('says the badge is not available against an old backend', async () => {
  load.mockResolvedValue(null);
  render(withCharacter(<BadgeDetailScreen />));
  expect(await screen.findByTestId('badge-detail-missing')).toBeTruthy();
});

it('offers a retry when the badges could not be loaded', async () => {
  mockParams = { family: 'SLEEP_GOAL' };
  load.mockRejectedValueOnce(new Error('offline'));
  render(withCharacter(<BadgeDetailScreen />));
  expect(await screen.findByTestId('badge-detail-error')).toBeTruthy();
  expect(screen.queryByTestId('badge-detail-missing')).toBeNull();
  load.mockResolvedValue(achievementsFixture());
  await act(async () => fireEvent.press(screen.getByTestId('badge-detail-retry')));
  expect(await screen.findByTestId('badge-detail-title')).toHaveTextContent('SLEEP GOAL STREAK');
});
