import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityScreen } from '../../src/screens/ActivityScreen';
import { fetchActivity } from '../../src/api/activity';
import { fetchRange, todayCivil } from '../../src/lib/heatmap';

jest.mock('../../src/api/activity');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ActivityScreen', () => {
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
