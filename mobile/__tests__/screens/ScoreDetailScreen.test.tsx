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
      { factor: 'RHR', label: 'Resting HR', z: -0.6, weight: 0.35, contribution: -0.21, points: -3.1, imputed: false, excluded: false },
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

  it('labels the RESTING_HR factor and its baseline as resting heart rate, never a daily minimum', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    const { getByText, queryByText } = render(<ScoreDetailScreen />);

    await waitFor(() => expect(getByText('Resting HR')).toBeTruthy());
    expect(getByText(/Your resting heart rate baseline: 52 bpm ± 3 bpm/)).toBeTruthy();
    expect(queryByText(/daily minimum/i)).toBeNull();
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

  it('defaults to RECOVERY when the route has no type param', async () => {
    mockParams = { date: '2026-09-19' };
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);

    render(<ScoreDetailScreen />);

    await waitFor(() => expect(fetchScoreDetail).toHaveBeenCalledWith('2026-09-19', 'RECOVERY'));
    expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Recovery Score' });
  });

  describe('Sleep Score (type=SLEEP)', () => {
    const sleepDetail: ScoreDetailDTO = {
      score: {
        date: '2026-09-19',
        type: 'SLEEP',
        score: 71,
        confidenceLevel: 'MEDIUM',
        algorithmVersion: 'v1',
        factors: [
          { factor: 'CIRCADIAN_CONSISTENCY', label: 'Bedtime consistency', z: null, weight: 0.2, contribution: 0, points: 0, imputed: false, excluded: true },
          { factor: 'SLEEP_EFFICIENCY', label: 'Sleep efficiency', z: 0.5, weight: 0.35, contribution: 0.18, points: 2.1, imputed: false, excluded: false },
          { factor: 'SLEEP_DURATION', label: 'Sleep duration', z: -1, weight: 0.45, contribution: -0.45, points: -6.4, imputed: false, excluded: false },
        ],
        coldStart: [{ metric: 'CIRCADIAN_CONSISTENCY', daysCollected: 9, daysRequired: 27 }],
      },
      baselines: [
        { metric: 'SLEEP_EFFICIENCY', ewma: 91.2, spread: 3, daysOfHistory: 30, windowDays: 30, unit: '%' },
        { metric: 'CIRCADIAN_CONSISTENCY', ewma: 78, spread: 8, daysOfHistory: 9, windowDays: 30, unit: 'pts' },
      ],
      previous: null,
    };

    beforeEach(() => {
      mockParams = { date: '2026-09-19', type: 'SLEEP' };
    });

    it('requests the SLEEP detail and titles the header Sleep Score', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue(sleepDetail);

      render(<ScoreDetailScreen />);

      await waitFor(() => expect(fetchScoreDetail).toHaveBeenCalledWith('2026-09-19', 'SLEEP'));
      expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Sleep Score' });
    });

    it('renders ring, confidence badge, headline, factor bars (server labels) and baselines in order', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue(sleepDetail);

      const { getByTestId, getByText, toJSON } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getByTestId('score-ring')).toBeTruthy());
      expect(getByText('71')).toBeTruthy();
      expect(getByTestId('confidence-badge')).toBeTruthy();
      expect(getByText(/Sleep duration is the biggest drag on your Sleep Score today \(−6\.4 pts\)\./)).toBeTruthy();
      expect(getByText(/against your sleep goal/)).toBeTruthy();
      expect(getByText(/Bedtime consistency needs a few more nights/)).toBeTruthy();
      expect(getByText(/not a medical assessment/)).toBeTruthy();
      expect(getByText('Sleep efficiency')).toBeTruthy();
      expect(getByText('Your sleep efficiency baseline: 91.2% ± 3%, based on your last 30 days.')).toBeTruthy();
      expect(getByText('Your bedtime consistency baseline: 78 pts ± 8 pts, based on the 9 days of data so far.')).toBeTruthy();

      const tree = JSON.stringify(toJSON());
      const order = ['"score-ring"', '"confidence-badge"', 'biggest drag', '"factor-bar-SLEEP_DURATION"', 'sleep efficiency baseline'].map((n) => tree.indexOf(n));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('lists factors by |points| with the excluded one last and marked as building', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue(sleepDetail);

      const { getAllByTestId, getByText } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getAllByTestId(/^factor-bar-[A-Z_]+$/)).toHaveLength(3));
      expect(getAllByTestId(/^factor-bar-[A-Z_]+$/).map((n) => n.props.testID)).toEqual([
        'factor-bar-SLEEP_DURATION',
        'factor-bar-SLEEP_EFFICIENCY',
        'factor-bar-CIRCADIAN_CONSISTENCY',
      ]);
      expect(getByText('Building baseline')).toBeTruthy();
      expect(getByText('9/27 days of bedtime consistency')).toBeTruthy();
    });

    it('does not present a sleep-duration baseline as if duration were scored against it', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue({
        ...sleepDetail,
        baselines: [{ metric: 'SLEEP', ewma: 430, spread: 40, daysOfHistory: 30, windowDays: 30, unit: 'min' }, ...sleepDetail.baselines],
      });

      const { queryByText, getByText } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getByText(/sleep efficiency baseline/)).toBeTruthy());
      expect(queryByText(/Your sleep baseline/)).toBeNull();
    });

    it('shows the baseline-progress ring, not a score ring, when the Sleep Score is null', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue({
        score: {
          ...sleepDetail.score,
          score: null,
          confidenceLevel: 'LOW',
          factors: sleepDetail.score.factors.map((f) => ({ ...f, points: 0, excluded: true })),
          coldStart: [{ metric: 'SLEEP', daysCollected: 4, daysRequired: 7 }],
        },
        baselines: [],
        previous: null,
      });

      const { getByTestId, getByText, queryByTestId } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getByTestId('baseline-progress-ring')).toBeTruthy());
      expect(getByText('4/7 days')).toBeTruthy();
      expect(queryByTestId('score-ring')).toBeNull();
      expect(getByText(/Your Sleep Score isn’t ready yet/)).toBeTruthy();
    });

    it('shows a loading state while the Sleep Score is being fetched', () => {
      (fetchScoreDetail as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { getByTestId } = render(<ScoreDetailScreen />);

      expect(getByTestId('score-detail-loading')).toBeTruthy();
    });

    it('shows an empty state when there is no Sleep Score for that day', async () => {
      (fetchScoreDetail as jest.Mock).mockResolvedValue(null);

      const { getByText } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getByText(/No score for this day yet/i)).toBeTruthy());
    });

    it('shows an error state when the Sleep Score fetch fails', async () => {
      (fetchScoreDetail as jest.Mock).mockRejectedValue(new Error('network error'));

      const { getByText } = render(<ScoreDetailScreen />);

      await waitFor(() => expect(getByText(/Something went wrong/i)).toBeTruthy());
    });
  });
});
