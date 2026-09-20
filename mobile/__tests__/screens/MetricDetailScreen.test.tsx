import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { MetricDetailScreen } from '../../src/screens/MetricDetailScreen';

const mockSetOptions = jest.fn();
let mockParams: unknown;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MetricDetailScreen', () => {
  it('shows the latest value, min/average/max, an insight, and recent readings for the given metric', async () => {
    mockParams = {
      metricType: 'STEPS',
      records: [
        { id: '1', metricType: 'STEPS', value: 8000, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '2', metricType: 'STEPS', value: 12000, recordedAt: '2026-09-02T00:00:00.000Z' },
      ],
    };

    const { getAllByText, getByText } = render(<MetricDetailScreen />);

    await waitFor(() => {
      expect(getAllByText(/12,000/).length).toBeGreaterThan(0);
    });

    // Min/average/max computed from the real series (8,000 and 12,000).
    expect(getAllByText(/8,000/).length).toBeGreaterThan(0);
    expect(getAllByText(/10,000/).length).toBeGreaterThan(0);

    // The headline insight and the goal-comparison sentence.
    expect(getByText('Steps is 50% above your recent average.')).toBeTruthy();
    expect(getByText(/Today's reading is 120% of your 10,000 steps\./)).toBeTruthy();

    // Recent readings list, most recent first. toDateString() is
    // timezone-dependent, so compute the expected strings the same way the
    // component does rather than hardcoding an assumed UTC date.
    expect(getByText(new Date('2026-09-02T00:00:00.000Z').toDateString())).toBeTruthy();
    expect(getByText(new Date('2026-09-01T00:00:00.000Z').toDateString())).toBeTruthy();
  });

  it('shows an empty state when the metric has no data', () => {
    mockParams = { metricType: 'HRV', records: [] };

    const { getByText } = render(<MetricDetailScreen />);

    expect(getByText(/No hrv data yet/i)).toBeTruthy();
  });

  it('sets the header title to the metric label', () => {
    mockParams = {
      metricType: 'RESTING_HR',
      records: [{ id: '1', metricType: 'RESTING_HR', value: 58, recordedAt: '2026-09-01T00:00:00.000Z' }],
    };

    render(<MetricDetailScreen />);

    expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Resting Heart Rate' });
  });
});
