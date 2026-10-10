import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityScreen } from '../../src/screens/ActivityScreen';
import { ActivityHeatmap } from '../../src/components/activity-heatmap';
import { fetchActivity } from '../../src/api/activity';
import { fetchSleep, fetchSleepGoal } from '../../src/api/sleep';
import { fetchRange, todayCivil } from '../../src/lib/heatmap';
import { apiFetch } from '../../src/api/client';
import { fetchScores } from '../../src/api/scores';

jest.mock('../../src/api/activity');
jest.mock('../../src/api/sleep');
jest.mock('../../src/api/client');
jest.mock('../../src/api/scores');

const mockNavigate = jest.fn();
// Screen events by name, so a test can fire focus/blur.
const mockListeners: Record<string, () => void> = {};
const mockNavigation = {
  navigate: mockNavigate,
  setParams: jest.fn(),
  addListener: (event: string, fn: () => void) => {
    mockListeners[event] = fn;
    return () => delete mockListeners[event];
  },
};
// The Activity tab's route params (a date handed in by the Sleep page).
let mockRouteParams: { date?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  (fetchSleep as jest.Mock).mockResolvedValue({ nights: [], earliestDate: null });
  (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 480, bedtimeGoal: null, wakeGoal: null });
  (apiFetch as jest.Mock).mockResolvedValue([]);
  (fetchScores as jest.Mock).mockResolvedValue([]);
});

describe('ActivityScreen: sleep', () => {
  it('fetches sleep over the same range as steps, alongside it', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockResolvedValue({
      nights: [{ date: todayCivil(), minutesAsleep: 452, minutesInBed: 480, bedtime: '23:10', wakeTime: '07:10', sleepScore: 80 }],
      earliestDate: '2025-01-01',
    });

    const { findByTestId } = render(<ActivityScreen />);

    expect(await findByTestId('sleep-stat-average')).toHaveTextContent('7h 32m');
    const { from, to } = fetchRange(todayCivil());
    expect(fetchSleep).toHaveBeenCalledWith(from, to);
  });

  it('keeps steps working when only sleep fails, and retries sleep from the Sleep page', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [{ date: todayCivil(), steps: 4321 }], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    const { findByTestId, getByTestId } = render(<ActivityScreen />);

    expect(await findByTestId('sleep-error')).toBeTruthy();
    expect(getByTestId('stat-total')).toHaveTextContent('4,321');

    fireEvent.press(getByTestId('sleep-retry'));

    expect(await findByTestId('sleep-heatmap-stats')).toBeTruthy();
    expect(fetchSleep).toHaveBeenCalledTimes(2);
  });

  it('opens the Sleep screen from the Sleep page header', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });

    const { findByTestId, getByTestId } = render(<ActivityScreen />);

    fireEvent.press(await findByTestId('activity-page-sleep'));
    fireEvent.press(getByTestId('activity-sleep-details'));

    expect(mockNavigate).toHaveBeenCalledWith('Sleep', undefined);
  });
  it('opens a night on the Sleep page', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });

    const { findByTestId, UNSAFE_getByType } = render(<ActivityScreen />);
    await findByTestId('heatmap-stats');

    act(() => UNSAFE_getByType(ActivityHeatmap).props.onOpenNight('2026-10-01'));

    expect(mockNavigate).toHaveBeenCalledWith('Sleep', { date: '2026-10-01' });
  });

  it('a date param opens that day on the steps page, then clears the param', async () => {
    mockRouteParams = { date: '2026-10-01' };
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [{ date: '2026-10-01', steps: 7000 }], earliestDate: '2025-01-01' });
    const { findByTestId } = render(<ActivityScreen />);
    expect(await findByTestId('day-detail-steps')).toHaveTextContent('7,000 steps');
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ date: undefined });
  });
});

describe('ActivityScreen: sleep goal', () => {
  // 452 min asleep: at goal against 420, short of 480.
  const lastNight = () => ({
    nights: [{ date: todayCivil(), minutesAsleep: 452, minutesInBed: 480, bedtime: '23:10', wakeTime: '07:10', sleepScore: 80 }],
    earliestDate: '2025-01-01',
  });

  it('colours sleep against the saved goal', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockResolvedValue(lastNight());
    (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 420, bedtimeGoal: null, wakeGoal: null });

    const { findByTestId, UNSAFE_getByType } = render(<ActivityScreen />);

    expect(await findByTestId('sleep-stat-goal')).toHaveTextContent('1');
    expect(UNSAFE_getByType(ActivityHeatmap).props.sleepGoal).toBe(420);
  });

  it('falls back to 8h when the goal cannot be read', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockResolvedValue(lastNight());
    (fetchSleepGoal as jest.Mock).mockRejectedValue(new Error('offline'));

    const { findByTestId, UNSAFE_getByType } = render(<ActivityScreen />);

    expect(await findByTestId('sleep-stat-goal')).toHaveTextContent('0');
    expect(UNSAFE_getByType(ActivityHeatmap).props.sleepGoal).toBe(480);
  });

  it('picks up a goal saved elsewhere on coming back to the tab', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockResolvedValue(lastNight());

    const { findByTestId, getByTestId, queryByTestId, UNSAFE_getByType } = render(<ActivityScreen />);
    expect(await findByTestId('sleep-stat-goal')).toHaveTextContent('0');
    // The first focus (opening the tab) loads nothing extra.
    await act(async () => mockListeners.focus?.());
    expect(fetchSleepGoal).toHaveBeenCalledTimes(1);

    (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 420, bedtimeGoal: '23:00', wakeGoal: '07:00' });
    await act(async () => mockListeners.blur?.());
    await act(async () => mockListeners.focus?.());

    await waitFor(() => expect(getByTestId('sleep-stat-goal')).toHaveTextContent('1'));
    expect(UNSAFE_getByType(ActivityHeatmap).props.sleepGoal).toBe(420);
    // Re-read in place: the loading state never came back.
    expect(queryByTestId('activity-loading')).toBeNull();
  });

  it('waits for the goal before drawing, so the colours never jump', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (fetchSleep as jest.Mock).mockResolvedValue(lastNight());
    let resolveGoal: (g: unknown) => void = () => {};
    (fetchSleepGoal as jest.Mock).mockReturnValue(new Promise((r) => (resolveGoal = r)));

    const { findByTestId, getByTestId, queryByTestId } = render(<ActivityScreen />);
    await act(async () => {});

    expect(getByTestId('activity-loading')).toBeTruthy();
    expect(queryByTestId('sleep-stat-goal')).toBeNull();
    await act(async () => resolveGoal({ sleepGoalMinutes: 420, bedtimeGoal: null, wakeGoal: null }));
    expect(await findByTestId('sleep-stat-goal')).toHaveTextContent('1');
  });
});

describe('ActivityScreen', () => {
  it('syncs with Google Health on pull-to-refresh, then re-reads', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: null });
    const syncNow = jest.fn().mockResolvedValue(undefined);
    const syncModule = require('../../src/sync/SyncProvider');
    const spy = jest
      .spyOn(syncModule, 'useSync')
      .mockReturnValue({ state: 'idle', lastSyncedAt: null, connection: 'CONNECTED', dataVersion: 0, syncNow });
    const { UNSAFE_getByType, findByTestId } = render(<ActivityScreen />);
    await findByTestId('heatmap-stats');
    expect(fetchActivity).toHaveBeenCalledTimes(1);

    const { ScrollView } = require('react-native');
    await act(async () => {
      await UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh();
    });

    expect(syncNow).toHaveBeenCalledWith('pull');
    expect(fetchActivity).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('fetches the whole range every view needs in one request, then shows the heat map', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [{ date: todayCivil(), steps: 4321 }], earliestDate: '2025-01-01' });

    const { getByTestId, findByTestId, queryByTestId } = render(<ActivityScreen />);

    expect(getByTestId('activity-loading')).toBeTruthy();
    expect(await findByTestId('heatmap-stats')).toBeTruthy();
    expect(queryByTestId('activity-loading')).toBeNull();
    const { from, to } = fetchRange(todayCivil());
    expect(fetchActivity).toHaveBeenCalledTimes(1);
    expect(fetchActivity).toHaveBeenCalledWith(from, to);
    expect(getByTestId('stat-total')).toHaveTextContent('4,321');
  });

  it('offers a retry when the request fails, and recovers', async () => {
    (fetchActivity as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (fetchActivity as jest.Mock).mockResolvedValueOnce({ days: [], earliestDate: null });

    const { findByTestId } = render(<ActivityScreen />);

    fireEvent.press(await findByTestId('activity-retry'));

    expect(await findByTestId('heatmap-history-note')).toHaveTextContent('Your step history is still syncing.');
    await waitFor(() => expect(fetchActivity).toHaveBeenCalledTimes(2));
  });
});

describe('ActivityScreen: against your usual', () => {
  it('shows the usual tiles under the heat map, with 60 days of Recovery (a 30-day change needs the 30 before)', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (apiFetch as jest.Mock).mockResolvedValue([{ id: 'h', metricType: 'HRV', value: 61, recordedAt: `${todayCivil()}T00:00:00.000Z` }]);
    (fetchScores as jest.Mock).mockResolvedValue([
      { date: todayCivil(), type: 'RECOVERY', score: 71, confidenceLevel: 'HIGH', algorithmVersion: 'v1', factors: [], coldStart: [] },
    ]);

    const { findByTestId, getByTestId } = render(<ActivityScreen />);

    expect(await findByTestId('usual-tiles')).toBeTruthy();
    expect(getByTestId('heatmap-stats')).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith('/me/biometrics');
    expect(fetchScores).toHaveBeenCalledWith(60, 'RECOVERY');
    expect(getByTestId('usual-tile-RECOVERY')).toHaveTextContent(/71/);
  });

  it('still shows the heat map without the tiles when the metrics read fails', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (apiFetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { findByTestId, queryByTestId } = render(<ActivityScreen />);

    expect(await findByTestId('heatmap-stats')).toBeTruthy();
    expect(queryByTestId('usual-tiles')).toBeNull();
    expect(queryByTestId('activity-error')).toBeNull();
  });

  it('stays ready with the heat map and the metric tiles when the Recovery read fails', async () => {
    (fetchActivity as jest.Mock).mockResolvedValue({ days: [], earliestDate: '2025-01-01' });
    (apiFetch as jest.Mock).mockResolvedValue([{ id: 'h', metricType: 'HRV', value: 61, recordedAt: `${todayCivil()}T00:00:00.000Z` }]);
    (fetchScores as jest.Mock).mockRejectedValue(new Error('offline'));

    const { findByTestId, getByTestId, queryByTestId } = render(<ActivityScreen />);

    expect(await findByTestId('usual-tiles')).toBeTruthy();
    expect(getByTestId('heatmap-stats')).toBeTruthy();
    expect(getByTestId('usual-tile-HRV')).toHaveTextContent(/61/);
    expect(getByTestId('usual-tile-RECOVERY')).toHaveTextContent(/—/);
    expect(queryByTestId('activity-error')).toBeNull();
  });
});
