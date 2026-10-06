import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { fetchAchievements } from '../../src/api/achievements';
import { getTimezoneState } from '../../src/lib/timezone';
import { resetAchievements } from '../../src/lib/achievementsStore';
import { SettingsScreen } from '../../src/screens/SettingsScreen';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/achievements');

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievements();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'UTC', overridden: false });
});

it('shows the Badges card on Profile alongside Health data', async () => {
  (fetchAchievements as jest.Mock).mockResolvedValue(achievementsFixture({ SLEEP_GOAL: { level: 1 } }));
  render(<SettingsScreen />);
  expect(await screen.findByTestId('badges-card')).toBeTruthy();
  expect(screen.getByTestId('badges-count')).toHaveTextContent('BADGES · 1 OF 35');
  expect(screen.getByTestId('connect-health-row')).toBeTruthy();
});

it('leaves the card out against a backend without badges (404)', async () => {
  (fetchAchievements as jest.Mock).mockResolvedValue(null);
  render(<SettingsScreen />);
  await waitFor(() => expect(fetchAchievements).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByTestId('badges-card')).toBeNull();
  expect(screen.getByTestId('connect-health-row')).toBeTruthy();
});
