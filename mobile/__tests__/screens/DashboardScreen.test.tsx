import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../../src/screens/DashboardScreen';
import { apiFetch } from '../../src/api/client';

jest.mock('../../src/api/client');

describe('DashboardScreen', () => {
  it('renders fetched biometric records', async () => {
    (apiFetch as jest.Mock).mockResolvedValue([
      { id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' },
      { id: '2', metricType: 'RESTING_HR', value: 58, recordedAt: '2026-09-01T00:00:00.000Z' },
    ]);

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/STEPS/)).toBeTruthy();
      expect(getByText(/9000/)).toBeTruthy();
    });
  });

  it('shows an empty state when there are no records yet', async () => {
    (apiFetch as jest.Mock).mockResolvedValue([]);

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getByText(/No data yet/i)).toBeTruthy());
  });
});
