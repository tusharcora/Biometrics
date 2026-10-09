import React from 'react';
import { render } from '@testing-library/react-native';
import { ScoreDetailScreen, formatScoreDate } from '../../src/screens/ScoreDetailScreen';
import { fetchScoreDetail, type ScoreDetailDTO } from '../../src/api/scores';

jest.mock('../../src/api/scores');

const mockReplace = jest.fn();
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({ setOptions: jest.fn(), replace: mockReplace }),
}));

const detail: ScoreDetailDTO = {
  score: {
    date: '2026-09-19',
    type: 'SLEEP',
    score: 78,
    confidenceLevel: 'HIGH',
    algorithmVersion: 'v1',
    factors: [
      { factor: 'SLEEP_EFFICIENCY', label: 'Sleep efficiency', z: 1.2, weight: 0.35, contribution: 0.42, points: 8.2, imputed: false, excluded: false },
      { factor: 'SLEEP_DURATION', label: 'Sleep duration', z: -0.6, weight: 0.45, contribution: -0.27, points: -3.1, imputed: false, excluded: false },
    ],
    coldStart: [],
  },
  baselines: [],
  previous: null,
};

beforeEach(() => {
  mockParams = { date: '2026-09-19', type: 'SLEEP' };
});

describe('ScoreDetailScreen (redesign)', () => {
  it('labels the ring with the score’s own date', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);
    const { findByText } = render(<ScoreDetailScreen />);
    expect(await findByText('Sat, Sep 19')).toBeTruthy();
  });

  it('leads with a one-line verdict above the full explanation', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);
    const { findByText, getByTestId } = render(<ScoreDetailScreen />);
    expect(await findByText('Sleep efficiency is lifting it today.')).toBeTruthy();
    expect(getByTestId('score-headline')).toHaveTextContent(/not a medical assessment/);
  });

  it('names the score band next to the confidence', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);
    const { findByText } = render(<ScoreDetailScreen />);
    // 78 is Excellent under the default bands.
    expect(await findByText('Excellent')).toBeTruthy();
  });

  it('shows no band while the score is still cold-starting', async () => {
    const cold = {
      ...detail,
      score: { ...detail.score, score: null, factors: [], coldStart: [{ metric: 'SLEEP', daysCollected: 4, daysRequired: 7 }] },
    };
    (fetchScoreDetail as jest.Mock).mockResolvedValue(cold);
    const { findByTestId, queryByText } = render(<ScoreDetailScreen />);
    await findByTestId('baseline-progress-ring');
    expect(queryByText('Excellent')).toBeNull();
  });

  afterEach(() => expect(mockReplace).not.toHaveBeenCalled());
});

describe('formatScoreDate', () => {
  it('formats the civil date without shifting it by timezone', () => {
    expect(formatScoreDate('2026-09-01')).toBe('Tue, Sep 1');
  });
});
