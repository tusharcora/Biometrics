import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { DashboardScreen } from '../../src/screens/DashboardScreen';
import { apiFetch } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * The screen calls /me/biometrics, /me/connection and /me/scores independently, so route
 * each path to its own canned response rather than one blanket resolution.
 */
function mockApi(options: {
  records?: unknown;
  connection?: unknown;
  recordsError?: Error;
  scores?: unknown[];
  scoresError?: Error;
  habitsError?: Error;
}) {
  (apiFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/me/connection') {
      return Promise.resolve(options.connection ?? { status: 'CONNECTED' });
    }
    if (path.startsWith('/me/habits')) {
      if (options.habitsError) return Promise.reject(options.habitsError);
      if (path === '/me/habits/config') {
        return Promise.resolve({ habitTypes: [{ type: 'ALCOHOL', label: 'Alcohol', unit: 'drinks', exposureThreshold: 2, builtIn: true }] });
      }
      return Promise.resolve({ today: '2026-09-20', days: [{ habitDay: '2026-09-20', checkedIn: false, observed: { ALCOHOL: false } }] });
    }
    if (path.startsWith('/me/scores')) {
      if (options.scoresError) return Promise.reject(options.scoresError);
      return Promise.resolve({ scores: options.scores ?? [] });
    }
    if (options.recordsError) return Promise.reject(options.recordsError);
    return Promise.resolve(options.records ?? []);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({
    session: { accessToken: 'token' },
    signInWithApple: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: mockSignOut,
  });
});

describe('DashboardScreen', () => {
  it('renders fetched biometric records', async () => {
    mockApi({
      records: [
        { id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '2', metricType: 'RESTING_HR', value: 58, recordedAt: '2026-09-01T00:00:00.000Z' },
      ],
    });

    const { getAllByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getAllByText(/Steps/).length).toBeGreaterThan(0);
      expect(getAllByText(/9,000/).length).toBeGreaterThan(0);
    });
  });

  it('renders rings, an insight, and trend charts for every real metric', async () => {
    mockApi({
      records: [
        { id: '1', metricType: 'STEPS', value: 8000, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '2', metricType: 'STEPS', value: 12000, recordedAt: '2026-09-02T00:00:00.000Z' },
        { id: '3', metricType: 'RESTING_HR', value: 60, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '4', metricType: 'RESTING_HR', value: 58, recordedAt: '2026-09-02T00:00:00.000Z' },
        { id: '5', metricType: 'SLEEP', value: 420, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '6', metricType: 'SLEEP', value: 400, recordedAt: '2026-09-02T00:00:00.000Z' },
        { id: '7', metricType: 'HRV', value: 50, recordedAt: '2026-09-01T00:00:00.000Z' },
        { id: '8', metricType: 'HRV', value: 65.9, recordedAt: '2026-09-02T00:00:00.000Z' },
      ],
    });

    const { getAllByText, getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getAllByText('Steps').length).toBeGreaterThan(0);
      expect(getAllByText('Resting Heart Rate').length).toBeGreaterThan(0);
      expect(getAllByText('Sleep').length).toBeGreaterThan(0);
      expect(getAllByText('HRV').length).toBeGreaterThan(0);
    });

    // Latest value per metric renders in both the ring and the trend card.
    expect(getAllByText(/12,000/).length).toBeGreaterThan(0);
    expect(getAllByText(/58 bpm/).length).toBeGreaterThan(0);
    expect(getAllByText(/6h 40m/).length).toBeGreaterThan(0);
    expect(getAllByText(/65\.9 ms/).length).toBeGreaterThan(0);

    // The insight picks whichever metric deviates most from its own trailing
    // average -- Steps at +50% here beats HRV's +31.8%, Sleep's -4.8%, and
    // Resting Heart Rate's -3.3%.
    expect(getByText('Steps is 50% above your recent average.')).toBeTruthy();
  });

  it('opens a metric detail page with that metric\'s own series when a ring card is pressed', async () => {
    const stepsRecords = [
      { id: '1', metricType: 'STEPS', value: 8000, recordedAt: '2026-09-01T00:00:00.000Z' },
      { id: '2', metricType: 'STEPS', value: 12000, recordedAt: '2026-09-02T00:00:00.000Z' },
    ];
    mockApi({ records: stepsRecords });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('metric-card-STEPS')).toBeTruthy());
    fireEvent.press(getByTestId('metric-card-STEPS'));

    expect(mockNavigate).toHaveBeenCalledWith('MetricDetail', { metricType: 'STEPS', records: stepsRecords });
  });

  it('opens a metric detail page when its trend card is pressed', async () => {
    const stepsRecords = [
      { id: '1', metricType: 'STEPS', value: 8000, recordedAt: '2026-09-01T00:00:00.000Z' },
      { id: '2', metricType: 'STEPS', value: 12000, recordedAt: '2026-09-02T00:00:00.000Z' },
    ];
    mockApi({ records: stepsRecords });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('trend-card-STEPS')).toBeTruthy());
    fireEvent.press(getByTestId('trend-card-STEPS'));

    expect(mockNavigate).toHaveBeenCalledWith('MetricDetail', { metricType: 'STEPS', records: stepsRecords });
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

    await waitFor(() => expect(getByText(/Reconnect your Google Health/i)).toBeTruthy());
    // The stale numbers must not be presented as if they were current.
    expect(queryByText(/9,000/)).toBeNull();
  });

  it('navigates to ConnectHealth from the reconnect prompt', async () => {
    mockApi({ connection: { status: 'DISCONNECTED' }, records: [] });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('reconnect-health-button')).toBeTruthy());
    fireEvent.press(getByTestId('reconnect-health-button'));

    expect(mockNavigate).toHaveBeenCalledWith('ConnectHealth');
  });

  it('does not prompt a reconnect while the connection is healthy', async () => {
    mockApi({
      connection: { status: 'CONNECTED' },
      records: [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }],
    });

    const { getAllByText, queryByText } = render(<DashboardScreen />);

    await waitFor(() => expect(getAllByText(/9,000/).length).toBeGreaterThan(0));
    expect(queryByText(/Reconnect your Google Health/i)).toBeNull();
  });

  it('offers a sign-out affordance that calls signOut', async () => {
    mockApi({
      records: [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }],
    });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('sign-out-button')).toBeTruthy());
    fireEvent.press(getByTestId('sign-out-button'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('keeps sign-out reachable from the reconnect prompt', async () => {
    mockApi({ connection: { status: 'DISCONNECTED' }, records: [] });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('sign-out-button')).toBeTruthy());
    fireEvent.press(getByTestId('sign-out-button'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('opens Profile from the header', async () => {
    mockApi({
      records: [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }],
    });

    const { getByTestId } = render(<DashboardScreen />);

    await waitFor(() => expect(getByTestId('settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('settings-button'));

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Profile' });
  });

  describe('habit logging and patterns', () => {
    const steps = [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }];

    it('shows the "Anything to log today?" card below the Recovery card', async () => {
      mockApi({ records: steps, scores: [] });

      const { getByText, getByTestId, toJSON } = render(<DashboardScreen />);

      await waitFor(() => expect(getByText('Anything to log today?')).toBeTruthy());
      expect(getByTestId('nothing-today-button')).toBeTruthy();
      expect(apiFetch).toHaveBeenCalledWith('/me/habits/config');
      expect(apiFetch).toHaveBeenCalledWith('/me/habits/status?days=14');

      const tree = JSON.stringify(toJSON());
      expect(tree.indexOf('Recovery Score will appear')).toBeGreaterThanOrEqual(0);
      expect(tree.indexOf('Recovery Score will appear')).toBeLessThan(tree.indexOf('Anything to log today?'));
      expect(tree.indexOf('Anything to log today?')).toBeLessThan(tree.indexOf('metric-card-STEPS'));
    });

    it('keeps the rest of the dashboard when the habit endpoints fail, with a retry', async () => {
      mockApi({ records: steps, habitsError: new Error('boom') });

      const { getByText, getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByText(/Habits are unavailable/i)).toBeTruthy());
      expect(getByTestId('habit-log-retry')).toBeTruthy();
      expect(getByTestId('metric-card-STEPS')).toBeTruthy();
    });

    it('opens the Patterns screen from the dashboard', async () => {
      mockApi({ records: steps });

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('patterns-button')).toBeTruthy());
      fireEvent.press(getByTestId('patterns-button'));

      expect(mockNavigate).toHaveBeenCalledWith('Patterns');
    });
  });

  describe('Recovery score card', () => {
    const steps = [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }];
    const recovery = {
      date: '2026-09-19',
      type: 'RECOVERY',
      score: 78,
      confidenceLevel: 'HIGH',
      algorithmVersion: 'v1',
      factors: [
        { factor: 'HRV', label: 'HRV', z: 1.2, weight: 0.45, contribution: 0.54, points: 8.2, imputed: false, excluded: false },
      ],
      coldStart: [],
    };

    it('shows the latest recovery score with its confidence at the top of the dashboard', async () => {
      mockApi({ records: steps, scores: [{ ...recovery, type: 'SLEEP', score: 55 }, recovery] });

      const { getByTestId, getByText } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('recovery-score-card')).toBeTruthy());
      // The SLEEP entry is a distractor for the Recovery card (it has its own card).
      const card = within(getByTestId('recovery-score-card'));
      expect(card.getByText('78')).toBeTruthy();
      expect(getByText('Recovery Score')).toBeTruthy();
      expect(card.getByTestId('confidence-badge')).toBeTruthy();
      expect(apiFetch).toHaveBeenCalledWith('/me/scores?days=7');
    });

    it('opens the score detail screen for that day when pressed', async () => {
      mockApi({ records: steps, scores: [recovery] });

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('recovery-score-card')).toBeTruthy());
      fireEvent.press(getByTestId('recovery-score-card'));

      expect(mockNavigate).toHaveBeenCalledWith('ScoreDetail', { date: '2026-09-19', type: 'RECOVERY' });
    });

    it('shows the baseline progress ring instead of a score when the score is null', async () => {
      mockApi({
        records: steps,
        scores: [
          {
            ...recovery,
            score: null,
            confidenceLevel: 'LOW',
            factors: [],
            coldStart: [
              { metric: 'HRV', daysCollected: 9, daysRequired: 14 },
              { metric: 'RESTING_HR', daysCollected: 3, daysRequired: 14 },
            ],
          },
        ],
      });

      const { getByTestId, getByText, queryByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('baseline-progress-ring')).toBeTruthy());
      expect(getByText('9/14 days')).toBeTruthy();
      expect(queryByTestId('score-ring')).toBeNull();
      expect(queryByTestId('confidence-badge')).toBeNull();
    });

    it('says the score is not ready when none has been calculated yet, without breaking the metric cards', async () => {
      mockApi({ records: steps, scores: [] });

      const { getByText, getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByText(/Recovery Score will appear/i)).toBeTruthy());
      expect(getByTestId('metric-card-STEPS')).toBeTruthy();
    });

    it('degrades to an inline message when the scores request fails, keeping the metric cards', async () => {
      mockApi({ records: steps, scoresError: new Error('boom') });

      const { getByText, getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByText(/Recovery Score is unavailable/i)).toBeTruthy());
      expect(getByTestId('metric-card-STEPS')).toBeTruthy();
    });
  });

  describe('Sleep score card', () => {
    const steps = [{ id: '1', metricType: 'STEPS', value: 9000, recordedAt: '2026-09-01T00:00:00.000Z' }];
    const recovery = {
      date: '2026-09-19',
      type: 'RECOVERY',
      score: 78,
      confidenceLevel: 'HIGH',
      algorithmVersion: 'v1',
      factors: [{ factor: 'HRV', label: 'HRV', z: 1.2, weight: 0.45, contribution: 0.54, points: 8.2, imputed: false, excluded: false }],
      coldStart: [],
    };
    const sleep = {
      date: '2026-09-19',
      type: 'SLEEP',
      score: 64,
      confidenceLevel: 'MEDIUM',
      algorithmVersion: 'v1',
      factors: [
        { factor: 'SLEEP_DURATION', label: 'Sleep duration', z: -0.5, weight: 0.45, contribution: -0.2, points: -3, imputed: false, excluded: false },
        { factor: 'SLEEP_EFFICIENCY', label: 'Sleep efficiency', z: 0.7, weight: 0.35, contribution: 0.25, points: 4, imputed: false, excluded: false },
        { factor: 'CIRCADIAN_CONSISTENCY', label: 'Bedtime consistency', z: null, weight: 0.2, contribution: 0, points: 0, imputed: false, excluded: true },
      ],
      coldStart: [{ metric: 'CIRCADIAN_CONSISTENCY', daysCollected: 9, daysRequired: 27 }],
    };

    it('shows the latest Sleep Score with a confidence badge, even with a factor still building', async () => {
      mockApi({ records: steps, scores: [recovery, sleep] });

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-card')).toBeTruthy());
      const card = within(getByTestId('sleep-score-card'));
      expect(card.getByText('Sleep Score')).toBeTruthy();
      expect(card.getByText('64')).toBeTruthy();
      expect(card.getByTestId('confidence-badge')).toBeTruthy();
      expect(card.queryByTestId('baseline-progress-ring')).toBeNull();
      // Recovery card is unaffected and both come from one request.
      expect(within(getByTestId('recovery-score-card')).getByText('78')).toBeTruthy();
      expect((apiFetch as jest.Mock).mock.calls.filter(([p]) => String(p).startsWith('/me/scores'))).toHaveLength(1);
    });

    it('renders the Sleep card below the Recovery card', async () => {
      mockApi({ records: steps, scores: [recovery, sleep] });

      const { getByTestId, toJSON } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-card')).toBeTruthy());
      const tree = JSON.stringify(toJSON());
      expect(tree.indexOf('recovery-score-card')).toBeLessThan(tree.indexOf('sleep-score-card'));
    });

    it('opens the SLEEP score detail for that day when pressed', async () => {
      mockApi({ records: steps, scores: [recovery, sleep] });

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-card')).toBeTruthy());
      fireEvent.press(getByTestId('sleep-score-card'));

      expect(mockNavigate).toHaveBeenCalledWith('ScoreDetail', { date: '2026-09-19', type: 'SLEEP' });
    });

    it('shows the cold-start ring, and no score ring or badge, when the Sleep Score is null', async () => {
      mockApi({
        records: steps,
        scores: [
          recovery,
          { ...sleep, score: null, confidenceLevel: 'LOW', coldStart: [{ metric: 'SLEEP', daysCollected: 4, daysRequired: 7 }] },
        ],
      });

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-card')).toBeTruthy());
      const card = within(getByTestId('sleep-score-card'));
      expect(card.getByTestId('baseline-progress-ring')).toBeTruthy();
      expect(card.getByText('4/7 days')).toBeTruthy();
      expect(card.queryByTestId('score-ring')).toBeNull();
      expect(card.queryByTestId('confidence-badge')).toBeNull();
    });

    it('explains there is no Sleep Score yet when no sleep was recorded, without a ring', async () => {
      mockApi({ records: steps, scores: [recovery] });

      const { getByTestId, getByText } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-empty')).toBeTruthy());
      expect(getByText(/Sleep Score will appear/i)).toBeTruthy();
      expect(getByTestId('recovery-score-card')).toBeTruthy();
    });

    it('degrades to an inline message when the scores request fails, keeping the metric cards', async () => {
      mockApi({ records: steps, scoresError: new Error('boom') });

      const { getByText, getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByText(/Sleep Score is unavailable/i)).toBeTruthy());
      expect(getByTestId('sleep-score-unavailable')).toBeTruthy();
      expect(getByTestId('metric-card-STEPS')).toBeTruthy();
    });

    it('shows a skeleton while scores load', async () => {
      mockApi({ records: steps });
      const base = (apiFetch as jest.Mock).getMockImplementation()!;
      (apiFetch as jest.Mock).mockImplementation((path: string) =>
        path.startsWith('/me/scores') ? new Promise(() => {}) : base(path),
      );

      const { getByTestId } = render(<DashboardScreen />);

      await waitFor(() => expect(getByTestId('sleep-score-loading')).toBeTruthy());
    });
  });
});
