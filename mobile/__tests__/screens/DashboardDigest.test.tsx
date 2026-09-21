import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../../src/screens/DashboardScreen';
import { apiFetch } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { fetchCoachStatus, fetchLatestDigest, type CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');
jest.mock('../../src/api/coach');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'a',
  personas: [],
};

const digest = { id: 'd1', text: 'A steady week overall.', createdAt: '2026-09-20T12:00:00.000Z' };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: { accessToken: 't' }, signOut: jest.fn() });
  (apiFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/me/connection') return Promise.resolve({ status: 'CONNECTED' });
    if (path.startsWith('/me/habits')) {
      return Promise.resolve(path === '/me/habits/config' ? { habitTypes: [] } : { today: '2026-09-20', days: [] });
    }
    if (path.startsWith('/me/scores')) return Promise.resolve({ scores: [] });
    return Promise.resolve([{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }]);
  });
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestDigest as jest.Mock).mockResolvedValue(digest);
});

describe('DashboardScreen: weekly digest card', () => {
  it('shows the digest when the coach is enabled and consented', async () => {
    const { findByTestId } = render(<DashboardScreen />);

    expect(await findByTestId('coach-digest-preview')).toHaveTextContent('A steady week overall.');
  });

  it('is hidden when there is no digest', async () => {
    (fetchLatestDigest as jest.Mock).mockResolvedValue(null);
    const { findByTestId, queryByTestId } = render(<DashboardScreen />);

    await findByTestId('coach-entry-button');
    await waitFor(() => expect(fetchLatestDigest).toHaveBeenCalled());
    expect(queryByTestId('coach-digest-card')).toBeNull();
  });

  it('never asks for or shows a digest when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId } = render(<DashboardScreen />);

    await findByTestId('patterns-button');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(fetchLatestDigest).not.toHaveBeenCalled();
    expect(queryByTestId('coach-digest-card')).toBeNull();
  });

  it('never asks for or shows a digest when enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = render(<DashboardScreen />);

    await findByTestId('coach-entry-button');
    expect(fetchLatestDigest).not.toHaveBeenCalled();
    expect(queryByTestId('coach-digest-card')).toBeNull();
  });

  it('never asks for or shows a digest when the status request fails', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId, queryByTestId } = render(<DashboardScreen />);

    await findByTestId('patterns-button');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(fetchLatestDigest).not.toHaveBeenCalled();
    expect(queryByTestId('coach-digest-card')).toBeNull();
  });

  it('a failing digest request does not disturb the rest of the dashboard', async () => {
    (fetchLatestDigest as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId } = render(<DashboardScreen />);

    expect(await findByTestId('coach-digest-error')).toBeTruthy();
    expect(await findByTestId('patterns-button')).toBeTruthy();
  });
});
