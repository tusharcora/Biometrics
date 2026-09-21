import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../../src/screens/DashboardScreen';
import { ScoreDetailScreen } from '../../src/screens/ScoreDetailScreen';
import { ScoreRing } from '../../src/components/ui/score-ring';
import { apiFetch } from '../../src/api/client';
import { fetchScoreDetail, type ScoreDetailDTO } from '../../src/api/scores';
import { useAuth } from '../../src/auth/AuthContext';
import { COLORS } from '../../src/theme';

// The band decides the ring colour; expose that colour so it can be asserted.
jest.mock('../../src/components/ui/ring', () => {
  const { View } = require('react-native');
  return {
    Ring: ({ color, children }: { color: string; children?: React.ReactNode }) => (
      <View testID="ring-stub" accessibilityLabel={color}>
        {children}
      </View>
    ),
  };
});
jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');
jest.mock('../../src/api/scores', () => ({
  ...jest.requireActual('../../src/api/scores'),
  fetchScoreDetail: jest.fn(),
}));

const mockParams: unknown = { date: '2026-09-19', type: 'RECOVERY' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

const SERVER_BANDS = { excellent: 90, good: 70, fair: 50 };
const recovery = {
  date: '2026-09-19',
  type: 'RECOVERY',
  score: 78,
  confidenceLevel: 'HIGH',
  algorithmVersion: 'v1',
  factors: [{ factor: 'HRV', label: 'HRV', z: 1.2, weight: 0.45, contribution: 0.54, points: 8.2, imputed: false, excluded: false }],
  coldStart: [],
};
const steps = [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }];

function mockDashboardApi(scoresResponse: unknown) {
  (apiFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/me/connection') return Promise.resolve({ status: 'CONNECTED' });
    if (path.startsWith('/me/habits')) return Promise.reject(new Error('n/a'));
    if (path.startsWith('/me/scores')) return Promise.resolve(scoresResponse);
    return Promise.resolve(steps);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ signOut: jest.fn() });
});

type Query = (id: string) => { props: { accessibilityLabel?: string } };
const ringColor = (getByTestId: Query) => getByTestId('ring-stub').props.accessibilityLabel;

describe('ScoreRing bands', () => {
  it('uses the default bands when none are given (78 is Excellent)', () => {
    const { getByTestId } = render(<ScoreRing score={78} />);
    expect(ringColor(getByTestId)).toBe(COLORS.light.scoreExcellent);
  });

  it('uses the given bands (78 is only Good when excellent starts at 90)', () => {
    const { getByTestId } = render(<ScoreRing score={78} bands={SERVER_BANDS} />);
    expect(ringColor(getByTestId)).toBe(COLORS.light.scoreGood);
  });
});

describe('Dashboard score bands', () => {
  it('colours the ring with the default bands when the server sends the defaults', async () => {
    mockDashboardApi({ scores: [recovery], bands: { excellent: 75, good: 55, fair: 40 } });
    const { getAllByTestId, findByTestId } = render(<DashboardScreen />);
    await findByTestId('recovery-score-card');
    expect(getAllByTestId('ring-stub')[0].props.accessibilityLabel).toBe(COLORS.light.scoreExcellent);
  });

  it('picks a different band when the server sends different thresholds', async () => {
    mockDashboardApi({ scores: [recovery], bands: SERVER_BANDS });
    const { getAllByTestId, findByTestId } = render(<DashboardScreen />);
    await findByTestId('recovery-score-card');
    expect(getAllByTestId('ring-stub')[0].props.accessibilityLabel).toBe(COLORS.light.scoreGood);
  });

  it('falls back to the defaults when the server sends no bands', async () => {
    mockDashboardApi({ scores: [recovery] });
    const { getAllByTestId, findByTestId } = render(<DashboardScreen />);
    await findByTestId('recovery-score-card');
    expect(getAllByTestId('ring-stub')[0].props.accessibilityLabel).toBe(COLORS.light.scoreExcellent);
  });
});

describe('ScoreDetail score bands', () => {
  const detail = (bands?: ScoreDetailDTO['bands']): ScoreDetailDTO => ({ score: recovery as never, baselines: [], previous: null, bands });

  it('picks a different band when the server sends different thresholds', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail(SERVER_BANDS));
    const { getByTestId } = render(<ScoreDetailScreen />);
    await waitFor(() => expect(getByTestId('ring-stub')).toBeTruthy());
    expect(ringColor(getByTestId)).toBe(COLORS.light.scoreGood);
  });

  it('falls back to the defaults when the server sends no bands', async () => {
    (fetchScoreDetail as jest.Mock).mockResolvedValue(detail());
    const { getByTestId } = render(<ScoreDetailScreen />);
    await waitFor(() => expect(getByTestId('ring-stub')).toBeTruthy());
    expect(ringColor(getByTestId)).toBe(COLORS.light.scoreExcellent);
  });
});
