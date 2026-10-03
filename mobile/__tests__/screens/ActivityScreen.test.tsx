import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityScreen } from '../../src/screens/ActivityScreen';
import { fetchActivity } from '../../src/api/activity';
import { fetchSleep } from '../../src/api/sleep';
import { fetchRange, todayCivil } from '../../src/lib/heatmap';

jest.mock('../../src/api/activity');
jest.mock('../../src/api/sleep');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (fetchSleep as jest.Mock).mockResolvedValue({ nights: [], earliestDate: null });
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

    expect(mockNavigate).toHaveBeenCalledWith('Sleep');
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
