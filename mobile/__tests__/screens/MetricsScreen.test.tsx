import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MetricsScreen } from '../../src/screens/MetricsScreen';
import { apiFetch } from '../../src/api/client';
import { addDays, todayCivil } from '../../src/lib/heatmap';

jest.mock('../../src/api/client');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Records are dated relative to the real today, so the ranges are exercised as a user would see them.
const today = todayCivil();
const daysAgo = (n: number) => `${addDays(today, -n)}T00:00:00.000Z`;

const records = [
  { id: 's-old', metricType: 'STEPS', value: 2000, recordedAt: daysAgo(40) },
  { id: 's-prev', metricType: 'STEPS', value: 8000, recordedAt: daysAgo(10) },
  { id: 's-1', metricType: 'STEPS', value: 9000, recordedAt: daysAgo(3) },
  { id: 's-2', metricType: 'STEPS', value: 11000, recordedAt: daysAgo(0) },
  { id: 'h-1', metricType: 'HRV', value: 42, recordedAt: daysAgo(50) },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MetricsScreen', () => {
  it('shows a trend card per metric for the default 30-day range', async () => {
    (apiFetch as jest.Mock).mockResolvedValue(records);

    const { findByTestId, getByTestId } = render(<MetricsScreen />);

    expect(await findByTestId('trend-latest-STEPS')).toHaveTextContent('11,000');
    expect(apiFetch).toHaveBeenCalledWith('/me/biometrics');
    // 30 days: 8,000 + 9,000 + 11,000.
    expect(getByTestId('trend-average-STEPS')).toHaveTextContent('Avg 9,333');
    expect(getByTestId('trend-change-STEPS')).toHaveTextContent('Up 367% vs the previous 30 days');
    expect(getByTestId('trend-empty-HRV')).toHaveTextContent('No hrv readings in the last 30 days.');
  });

  it('recomputes every card when the range changes', async () => {
    (apiFetch as jest.Mock).mockResolvedValue(records);

    const { findByTestId, getByTestId } = render(<MetricsScreen />);
    await findByTestId('trend-latest-STEPS');

    fireEvent.press(getByTestId('metrics-range-7d'));
    expect(getByTestId('trend-average-STEPS')).toHaveTextContent('Avg 10,000');
    expect(getByTestId('trend-change-STEPS')).toHaveTextContent('Up 25% vs the previous 7 days');

    fireEvent.press(getByTestId('metrics-range-90d'));
    expect(getByTestId('trend-latest-HRV')).toHaveTextContent('42.0 ms');
  });

  it("opens a metric's detail with the readings in the selected range", async () => {
    (apiFetch as jest.Mock).mockResolvedValue(records);

    const { findByTestId, getByTestId } = render(<MetricsScreen />);
    await findByTestId('trend-latest-STEPS');
    fireEvent.press(getByTestId('metrics-range-7d'));
    fireEvent.press(getByTestId('trend-card-STEPS'));

    expect(mockNavigate).toHaveBeenCalledWith('MetricDetail', {
      metricType: 'STEPS',
      records: [records[2], records[3]],
    });
  });

  it('opens Patterns from its entry card', async () => {
    (apiFetch as jest.Mock).mockResolvedValue(records);

    const { findByTestId } = render(<MetricsScreen />);
    fireEvent.press(await findByTestId('patterns-button'));

    expect(mockNavigate).toHaveBeenCalledWith('Patterns');
  });

  it('explains an empty account', async () => {
    (apiFetch as jest.Mock).mockResolvedValue([]);

    const { findByTestId } = render(<MetricsScreen />);

    expect(await findByTestId('metrics-empty')).toBeTruthy();
  });

  it('offers a retry when loading fails, and recovers', async () => {
    (apiFetch as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(records);

    const { findByTestId } = render(<MetricsScreen />);
    fireEvent.press(await findByTestId('metrics-retry'));

    expect(await findByTestId('trend-latest-STEPS')).toHaveTextContent('11,000');
  });
});
