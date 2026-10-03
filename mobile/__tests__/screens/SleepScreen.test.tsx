import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { SleepScreen } from '../../src/screens/SleepScreen';
import { fetchSleep, fetchSleepGoal, fetchSleepNight, fetchSleepRegularity, type SleepNight } from '../../src/api/sleep';
import { fetchScoresWithBands } from '../../src/api/scores';
import { addDays, todayCivil } from '../../src/lib/heatmap';

jest.mock('../../src/api/sleep');
jest.mock('../../src/api/scores');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const TODAY = todayCivil();
const D = (back: number) => addDays(TODAY, -back);

function night(date: string, extra: Partial<SleepNight> = {}): SleepNight {
  return {
    date,
    minutesAsleep: 420,
    minutesInBed: 460,
    bedtime: '23:10',
    wakeTime: '07:00',
    sleepScore: 70,
    minutesAwake: 30,
    stageMinutes: null,
    hasStages: false,
    ...extra,
  };
}

const NIGHTS = [
  night(D(3), { bedtime: null, wakeTime: null }),
  night(D(2), { bedtime: '22:40', wakeTime: '06:30' }),
  night(D(1)),
  night(D(0), { hasStages: true, stageMinutes: { deep: 60, light: 240, rem: 90, awake: 30 } }),
];

const REGULARITY = {
  days: 7,
  nights: 6,
  score: 80,
  bedtimeSpreadMinutes: 20,
  wakeSpreadMinutes: 15,
  averageBedtime: '23:00',
  averageWake: '07:00',
  drift: [
    { date: D(2), bedtimeOffsetMinutes: -20 },
    { date: D(1), bedtimeOffsetMinutes: 10 },
    { date: D(0), bedtimeOffsetMinutes: 45 },
  ],
};

const DETAIL = {
  date: D(0),
  bedtime: '23:10',
  wakeTime: '07:00',
  minutesAsleep: 420,
  minutesInBed: 470,
  minutesAwake: 30,
  minutesToFallAsleep: 10,
  minutesAfterWakeUp: 5,
  hasStages: true,
  stages: [
    { type: 'LIGHT', start: '2026-10-02T23:10:00.000Z', end: '2026-10-03T01:10:00.000Z' },
    { type: 'DEEP', start: '2026-10-03T01:10:00.000Z', end: '2026-10-03T02:10:00.000Z' },
    { type: 'REM', start: '2026-10-03T02:10:00.000Z', end: '2026-10-03T03:40:00.000Z' },
    { type: 'AWAKE', start: '2026-10-03T03:40:00.000Z', end: '2026-10-03T04:10:00.000Z' },
  ],
  stageTotals: {
    deep: { minutes: 60, count: 1 },
    light: { minutes: 120, count: 1 },
    rem: { minutes: 90, count: 1 },
    awake: { minutes: 30, count: 1 },
  },
  naps: [],
  sleepScore: 70,
  usualMinutesAsleep: null,
};

const SCORE = {
  date: TODAY,
  type: 'SLEEP',
  score: 72,
  confidenceLevel: 'HIGH',
  algorithmVersion: '1',
  factors: [],
  coldStart: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchSleep as jest.Mock).mockResolvedValue({ nights: NIGHTS, earliestDate: D(30), stagesBackfillPending: false });
  (fetchSleepRegularity as jest.Mock).mockResolvedValue(REGULARITY);
  (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 480, bedtimeGoal: null, wakeGoal: null });
  (fetchSleepNight as jest.Mock).mockResolvedValue(DETAIL);
  (fetchScoresWithBands as jest.Mock).mockResolvedValue({ scores: [SCORE] });
});

// Let every section's request settle inside act before the screen unmounts.
afterEach(async () => {
  await act(async () => {});
});

function renderScreen() {
  return render(withCharacter(<SleepScreen />, { characterId: 'luna' }));
}

describe('SleepScreen', () => {
  it('fetches the last week of nights and draws a bar per night with times', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('sleep-window-chart')).toBeTruthy());
    expect(fetchSleep).toHaveBeenCalledWith(D(6), TODAY);
    expect(screen.getByTestId(`sleep-window-bar-${D(2)}`)).toBeTruthy();
    expect(screen.getByTestId(`sleep-window-bar-${D(1)}`)).toBeTruthy();
    expect(screen.getByTestId(`sleep-window-bar-${D(0)}`)).toBeTruthy();
    // A night without times is a gap.
    expect(screen.queryByTestId(`sleep-window-bar-${D(3)}`)).toBeNull();
    expect(screen.getByTestId(`sleep-window-bar-${D(2)}`).props.accessibilityLabel).toMatch(/: 10:40 pm to 6:30 am$/);
  });

  it('opens a night when its bar is tapped', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId(`sleep-window-bar-${D(1)}`));

    expect(mockNavigate).toHaveBeenCalledWith('SleepNight', { date: D(1) });
  });

  it('refetches two weeks from the range toggle', async () => {
    renderScreen();
    await screen.findByTestId('sleep-window-chart');

    fireEvent.press(screen.getByTestId('sleep-range-two-weeks'));

    await waitFor(() => expect(fetchSleep).toHaveBeenLastCalledWith(D(13), TODAY));
    fireEvent.press(screen.getByTestId('sleep-range-week'));
    await waitFor(() => expect(fetchSleep).toHaveBeenLastCalledWith(D(6), TODAY));
    await screen.findByTestId('stage-strip');
  });

  it('shows a retry, not the old week, when switching to two weeks fails', async () => {
    renderScreen();
    await screen.findByTestId(`sleep-window-bar-${D(0)}`);

    (fetchSleep as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    fireEvent.press(screen.getByTestId('sleep-range-two-weeks'));

    const retry = await screen.findByTestId('sleep-window-retry');
    expect(screen.queryByTestId('sleep-window-chart')).toBeNull();
    expect(screen.getByTestId('sleep-range-two-weeks').props.accessibilityState).toMatchObject({ selected: true });

    (fetchSleep as jest.Mock).mockResolvedValue({ nights: [...NIGHTS, night(D(10))], earliestDate: D(30), stagesBackfillPending: false });
    fireEvent.press(retry);
    // The toggle and the chart agree: a night ten days back has a column.
    expect(await screen.findByTestId(`sleep-window-bar-${D(10)}`)).toBeTruthy();
    expect(fetchSleep).toHaveBeenLastCalledWith(D(13), TODAY);
  });

  it('keeps last night when a later sync refresh fails', async () => {
    const syncModule = require('../../src/sync/SyncProvider');
    const state = { state: 'idle', lastSyncedAt: null, connection: 'CONNECTED', dataVersion: 0, syncNow: jest.fn() };
    const spy = jest.spyOn(syncModule, 'useSync').mockReturnValue(state);
    const utils = renderScreen();
    await screen.findByTestId(`sleep-window-bar-${D(0)}`);

    (fetchSleep as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    spy.mockReturnValue({ ...state, dataVersion: 1 });
    utils.rerender(withCharacter(<SleepScreen />, { characterId: 'luna' }));

    await waitFor(() => expect(fetchSleep).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId(`sleep-window-bar-${D(0)}`)).toBeTruthy();
    expect(screen.queryByTestId('sleep-window-retry')).toBeNull();
    spy.mockRestore();
  });

  it('shows whichever goal time is set when only one is', async () => {
    (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 480, bedtimeGoal: '23:00', wakeGoal: null });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('sleep-goal-row')).toHaveTextContent(/Bed 11:00 pm · wake not set/));
  });

  it('retries last night after a failure', async () => {
    (fetchSleepNight as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderScreen();

    fireEvent.press(await screen.findByTestId('sleep-last-night-retry'));

    expect(await screen.findByTestId('stage-strip')).toBeTruthy();
    expect(fetchSleepNight).toHaveBeenCalledTimes(2);
  });

  it('lets only the latest last-night request land', async () => {
    const syncModule = require('../../src/sync/SyncProvider');
    const state = { state: 'idle', lastSyncedAt: null, connection: 'CONNECTED', dataVersion: 0, syncNow: jest.fn() };
    const spy = jest.spyOn(syncModule, 'useSync').mockReturnValue(state);
    let resolveFirst: (v: unknown) => void = () => {};
    (fetchSleepNight as jest.Mock).mockReturnValueOnce(new Promise((r) => (resolveFirst = r))).mockResolvedValue(DETAIL);
    const utils = renderScreen();
    await waitFor(() => expect(fetchSleepNight).toHaveBeenCalledTimes(1));

    // A sync starts a newer request, which answers first.
    spy.mockReturnValue({ ...state, dataVersion: 1 });
    utils.rerender(withCharacter(<SleepScreen />, { characterId: 'luna' }));
    const label = (await screen.findByTestId('stage-strip')).props.accessibilityLabel;

    // The older one resolves late with other stages; it must not replace the newer answer.
    await act(async () => {
      resolveFirst({ ...DETAIL, stages: [DETAIL.stages[0]] });
    });
    expect(screen.getByTestId('stage-strip').props.accessibilityLabel).toBe(label);
    spy.mockRestore();
  });

  it('shows the sleep regularity card with its caption and the coach line', async () => {
    renderScreen();

    const card = await screen.findByTestId('sleep-regularity');
    expect(fetchSleepRegularity).toHaveBeenCalledWith(7);
    expect(within(card).getByText('Sleep regularity')).toBeTruthy();
    expect(
      within(card).getByText(
        "Bedtime and wake time over the last 7 nights. Your Sleep score's Bedtime consistency uses bedtime over 14 nights.",
      ),
    ).toBeTruthy();
    expect(within(card).getByText('Luna: Steady nights. Keep the rhythm.')).toBeTruthy();
    expect(within(card).queryByText(/consistency$/i)).toBeNull();
  });

  it('counts down the nights still needed when there is no regularity score', async () => {
    (fetchSleepRegularity as jest.Mock).mockResolvedValue({
      ...REGULARITY,
      nights: 1,
      score: null,
      bedtimeSpreadMinutes: null,
      wakeSpreadMinutes: null,
    });
    renderScreen();

    const empty = await screen.findByTestId('sleep-regularity-empty');
    expect(empty).toHaveTextContent('Not enough nights yet. 3 more to go.');
  });

  it('shows the score header and opens the score detail from "Why this score"', async () => {
    renderScreen();

    await screen.findByTestId('sleep-score-header');
    fireEvent.press(screen.getByTestId('sleep-why-score'));

    expect(mockNavigate).toHaveBeenCalledWith('ScoreDetail', { date: TODAY, type: 'SLEEP' });
  });

  it('offers to set a bedtime goal and opens the goal screen', async () => {
    renderScreen();

    const row = await screen.findByTestId('sleep-goal-row');
    await waitFor(() => expect(row).toHaveTextContent(/Set a bedtime goal/));
    fireEvent.press(row);

    expect(mockNavigate).toHaveBeenCalledWith('BedtimeGoal');
  });

  it('shows the goal times when a goal is set', async () => {
    (fetchSleepGoal as jest.Mock).mockResolvedValue({ sleepGoalMinutes: 480, bedtimeGoal: '22:30', wakeGoal: '06:45' });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('sleep-goal-row')).toHaveTextContent(/10:30 pm to 6:45 am/));
  });

  it('shows last night with a stage strip and opens the whole night', async () => {
    renderScreen();

    const card = await screen.findByTestId('sleep-last-night');
    await waitFor(() => expect(fetchSleepNight).toHaveBeenCalledWith(D(0)));
    const strip = await within(card).findByTestId('stage-strip');
    expect(strip.props.accessibilityLabel).toBe('Sleep stages: 60 min deep, 90 min REM, 120 min light, 30 min awake');
    // A legend names the colours, so the strip never relies on colour alone.
    expect(within(card).getByText('Deep')).toBeTruthy();
    fireEvent.press(within(card).getByText('See the whole night'));

    expect(mockNavigate).toHaveBeenCalledWith('SleepNight', { date: D(0) });
  });

  it('says "Reading older nights…" only while the stage backfill is pending', async () => {
    (fetchSleep as jest.Mock).mockResolvedValue({ nights: NIGHTS, earliestDate: D(30), stagesBackfillPending: true });
    const { unmount } = renderScreen();
    expect(await screen.findByTestId('sleep-older-nights')).toHaveTextContent('Reading older nights…');
    unmount();

    (fetchSleep as jest.Mock).mockResolvedValue({ nights: NIGHTS, earliestDate: D(30), stagesBackfillPending: false });
    renderScreen();
    await screen.findByTestId('sleep-window-chart');
    expect(screen.queryByTestId('sleep-older-nights')).toBeNull();
  });

  it('puts a retry on the regularity card only when it fails', async () => {
    (fetchSleepRegularity as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderScreen();

    const retry = await screen.findByTestId('sleep-regularity-retry');
    expect(screen.getByTestId('sleep-window-chart')).toBeTruthy();
    expect(screen.queryByTestId('sleep-window-retry')).toBeNull();

    fireEvent.press(retry);
    expect(await screen.findByTestId('sleep-regularity')).toBeTruthy();
    expect(fetchSleepRegularity).toHaveBeenCalledTimes(2);
  });

  it('copes with no nights at all', async () => {
    (fetchSleep as jest.Mock).mockResolvedValue({ nights: [], earliestDate: null, stagesBackfillPending: false });
    (fetchSleepRegularity as jest.Mock).mockResolvedValue({
      days: 7,
      nights: 0,
      score: null,
      bedtimeSpreadMinutes: null,
      wakeSpreadMinutes: null,
      averageBedtime: null,
      averageWake: null,
      drift: [],
    });
    (fetchScoresWithBands as jest.Mock).mockResolvedValue({ scores: [] });
    renderScreen();

    expect(await screen.findByText('No sleep synced yet.')).toBeTruthy();
    expect(await screen.findByTestId('sleep-regularity-empty')).toHaveTextContent('Not enough nights yet. 4 more to go.');
    expect(fetchSleepNight).not.toHaveBeenCalled();
    expect(screen.getByTestId('sleep-goal-row')).toBeTruthy();
  });
});
