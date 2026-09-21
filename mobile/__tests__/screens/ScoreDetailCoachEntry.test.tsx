import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ScoreDetailScreen } from '../../src/screens/ScoreDetailScreen';
import { fetchScoreDetail, type ScoreDetailDTO } from '../../src/api/scores';
import { fetchCoachStatus, type CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/scores');
jest.mock('../../src/api/coach');

const mockNavigate = jest.fn();
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({ setOptions: jest.fn(), navigate: mockNavigate }),
}));

const detail: ScoreDetailDTO = {
  score: {
    date: '2026-09-19',
    type: 'RECOVERY',
    score: 78,
    confidenceLevel: 'MEDIUM',
    algorithmVersion: 'v1',
    factors: [{ factor: 'HRV', label: 'HRV', z: 1.2, weight: 0.45, contribution: 0.54, points: 8.2, imputed: false, excluded: false }],
    coldStart: [],
  },
  baselines: [],
  previous: { date: '2026-09-18', score: 70 },
};

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'a',
  personas: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { date: '2026-09-19', type: 'RECOVERY' };
  (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
});

describe('ScoreDetailScreen: Ask about this', () => {
  it('opens the chat with a prefilled question that contains no numbers', async () => {
    const { findByTestId } = render(<ScoreDetailScreen />);

    fireEvent.press(await findByTestId('ask-coach-button'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, params] = mockNavigate.mock.calls[0];
    expect(route).toBe('Coach');
    expect(params.prefill).toMatch(/why did my score change today/i);
    expect(params.prefill).not.toMatch(/\d/);
    // Neither the score (78) nor the date leaks into the prompt.
    expect(params.prefill).not.toContain('78');
    expect(params.prefill).not.toContain('2026');
  });

  it('asks about sleep on the Sleep Score, still without numbers', async () => {
    mockParams = { date: '2026-09-19', type: 'SLEEP' };
    (fetchScoreDetail as jest.Mock).mockResolvedValue({ ...detail, score: { ...detail.score, type: 'SLEEP' } });
    const { findByTestId } = render(<ScoreDetailScreen />);

    fireEvent.press(await findByTestId('ask-coach-button'));

    const [, params] = mockNavigate.mock.calls[0];
    expect(params.prefill).toMatch(/sleep/i);
    expect(params.prefill).not.toMatch(/\d/);
  });

  it('goes through the consent flow when the coach is enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId } = render(<ScoreDetailScreen />);

    fireEvent.press(await findByTestId('ask-coach-button'));

    expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', expect.objectContaining({ prefill: expect.any(String) }));
  });

  it('renders no button when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false, consented: true });
    const { findByTestId, queryByTestId } = render(<ScoreDetailScreen />);

    await findByTestId('score-headline');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('ask-coach-button')).toBeNull();
  });

  it('renders no button when the status request fails, and the score still shows', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId, queryByTestId } = render(<ScoreDetailScreen />);

    expect(await findByTestId('score-headline')).toBeTruthy();
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('ask-coach-button')).toBeNull();
  });
});
