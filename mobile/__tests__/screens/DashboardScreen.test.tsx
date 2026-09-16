import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../../src/screens/DashboardScreen';
import { apiFetch } from '../../src/api/client';

jest.mock('../../src/api/client');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * The screen calls /me/biometrics and /me/connection independently, so route
 * each path to its own canned response rather than one blanket resolution.
 */
function mockApi(options: { records?: unknown; connection?: unknown; recordsError?: Error }) {
  (apiFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/me/connection') {
      return Promise.resolve(options.connection ?? { status: 'CONNECTED' });
    }
    if (options.recordsError) return Promise.reject(options.recordsError);
    return Promise.resolve(options.records ?? []);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DashboardScreen', () => {
  it('renders fetched biometric records', async () => {
    mockApi({
      records: [
        { id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '2', metricType: 'RESTING_HR', value: 58, recordedAt: '2026-09-01T00:00:00.000Z' },
      ],
    });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/STEPS/)).toBeTruthy();
      expect(getByText(/9000/)).toBeTruthy();
    });
  });

  it('shows an empty state when there are no records yet', async () => {
    mockApi({ records: [] });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getByText(/No data yet/i)).toBeTruthy());
  });

  it('shows an error state when the fetch fails', async () => {
    mockApi({ recordsError: new Error('network error') });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getByText(/Something went wrong/i)).toBeTruthy());
  });

  it('prompts a reconnect instead of showing stale data when disconnected', async () => {
    mockApi({
      connection: { status: 'DISCONNECTED' },
      records: [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }],
    });

    const { getByText, queryByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getByText(/Reconnect your Fitbit/i)).toBeTruthy());
    // The stale numbers must not be presented as if they were current.
    expect(queryByText(/9000/)).toBeNull();
  });

  it('navigates to ConnectFitbit from the reconnect prompt', async () => {
    mockApi({ connection: { status: 'DISCONNECTED' }, records: [] });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('reconnect-fitbit-button')).toBeTruthy());
    fireEvent.press(getByTestId('reconnect-fitbit-button'));

    expect(mockNavigate).toHaveBeenCalledWith('ConnectFitbit');
  });

  it('does not prompt a reconnect while the connection is healthy', async () => {
    mockApi({
      connection: { status: 'CONNECTED' },
      records: [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }],
    });

    const { getByText, queryByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getByText(/9000/)).toBeTruthy());
    expect(queryByText(/Reconnect your Fitbit/i)).toBeNull();
  });
});
