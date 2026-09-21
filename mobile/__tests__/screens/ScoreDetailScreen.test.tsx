import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ScoreDetailScreen } from '../../src/screens/ScoreDetailScreen';
import { fetchScoreDetail, type ScoreDetailDTO } from '../../src/api/scores';

jest.mock('../../src/api/scores');

const mockSetOptions = jest.fn();
let mockParams: unknown;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

const detail: ScoreDetailDTO = {
  score: {
    date: '2026-09-19',
    type: 'RECOVERY',
    score: 78,
    confidenceLevel: 'MEDIUM',
    algorithmVersion: 'v1',
    factors: [
      { factor: 'SLEEP_DEBT', label: 'Sleep debt', z: -0.4, weight: 0.2, contribution: -0.08, points: -1.4, imputed: false, excluded: false },
      { factor: 'HRV', label: 'HRV', z: 1.2, weight: 0.45, contribution: 0.54, points: 8.2, imputed: false, excluded: false },
      { factor: 'RHR', label: 'Daily minimum HR', z: -0.6, weight: 0.35, contribution: -0.21, points: -3.1, imputed: false, excluded: false },
    ],
    coldStart: [],
  },
  baselines: [
    { metric: 'HRV', ewma: 42, spread: 6, daysOfHistory: 30, windowDays: 30, unit: 'ms' },
    { metric: 'RESTING_HR', ewma: 52, spread: 3, daysOfHistory: 30, windowDays: 30, unit: 'bpm' },
  ],
  previous: { date: '2026-09-18', score: 70 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { date: '2026-09-19', type: 'RECOVERY' };
});

describe('ScoreDetailScreen', () => {
  it('requests the score for the route date and type', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    render(<ScoreDetailScreen />);

    await waitFor(() => expect(fetchScoreDetail).toHaveBeenCalledWith('2026-09-19', 'RECOVERY'));
  });

  it('renders, top to bottom: ring, confidence badge, headline, factor bars, baselines', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    const { getByTestId, getByText, toJSON } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByTestId('score-ring')).toBeTruthy());
    expect(getByText('78')).toBeTruthy();
    expect(getByTestId('confidence-badge')).toBeTruthy();
    expect(getByText(/HRV is the biggest lift on your Recovery Score today \(\+8\.2 pts\)\./)).toBeTruthy();
    expect(getByText(/not a medical assessment/)).toBeTruthy();
    expect(getByText('Your HRV baseline: 42 ms ± 6 ms, based on your last 30 days.')).toBeTruthy();

    // Vertical order in the rendered tree.
    const tree = JSON.stringify(toJSON());
    const order = ['"score-ring"', '"confidence-badge"', 'biggest lift', '"factor-bar-HRV"', 'HRV baseline'].map((needle) => tree.indexOf(needle));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('lists every factor, signed, sorted by |points| descending', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    const { getAllByTestId } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getAllByTestId(/^factor-bar-(HRV|RHR|SLEEP_DEBT)$/)).toHaveLength(3));
    const ids = getAllByTestId(/^factor-bar-(HRV|RHR|SLEEP_DEBT)$/).map((node) => node.props.testID);
    expect(ids).toEqual(['factor-bar-HRV', 'factor-bar-RHR', 'factor-bar-SLEEP_DEBT']);
  });

  it('labels the RESTING_HR factor and its baseline as a daily minimum, never resting heart rate', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    const { getByText, queryByText } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByText('Daily minimum HR')).toBeTruthy());
    expect(getByText(/Your daily minimum heart rate baseline: 52 bpm ± 3 bpm/)).toBeTruthy();
    expect(queryByText(/resting heart rate/i)).toBeNull();
  });

  it('shows the baseline-progress state instead of a score ring on a cold-start day', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue({
      score: {
        ...detail.score,
        score: null,
        confidenceLevel: 'LOW',
        factors: detail.score.factors.map((f) => ({ ...f, z: null, points: 0, contribution: 0, excluded: true })),
        coldStart: [
          { metric: 'HRV', daysCollected: 9, daysRequired: 14 },
          { metric: 'RESTING_HR', daysCollected: 3, daysRequired: 14 },
        ],
      },
      baselines: [],
      previous: null,
    });

    const { getByTestId, getByText, queryByTestId } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByTestId('baseline-progress-ring')).toBeTruthy());
    expect(getByText('9/14 days')).toBeTruthy();
    expect(queryByTestId('score-ring')).toBeNull();
    expect(getByText(/isn’t ready yet/)).toBeTruthy();
  });

  it('shows a loading state while the score is being fetched', () => {
    (fetchScoreDetail as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<ScoreDetailScreen />);

    expect(getByTestId('score-detail-loading')).toBeTruthy();
  });

  it('shows an empty state when there is no score for that day', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(null);

    const { getByText } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByText(/No score for this day yet/i)).toBeTruthy());
  });

  it('shows an error state when the fetch fails', async () => {
    (fetchScoreDetail as jest.Mock).mockRejectedValue(new Error('network error'));

    const { getByText } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByText(/Something went wrong/i)).toBeTruthy());
  });

  it('sets the header title from the score type', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    render(<ScoreDetailScreen />);

    expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Recovery Score' });
  });
});
