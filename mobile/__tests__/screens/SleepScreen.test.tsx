import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { GOAL, REGULARITY, REMINDER, TODAY, makeDetail, makeNight, makeScore, makeWindow } from '../../jest-mocks/sleepPageFixture';
import { SleepScreen } from '../../src/screens/SleepScreen';
import { fetchSleep, fetchSleepGoal, fetchSleepNight, fetchSleepRegularity } from '../../src/api/sleep';
import { fetchScoreDetail } from '../../src/api/scores';
import { readWindDown } from '../../src/lib/windDown';
import { SLEEP_SCORE_FRAMING } from '../../src/lib/scoreInsights';
import { regularityA11y } from '../../src/lib/sleepCopy';
import { COLORS } from '../../src/theme';
import type { CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/sleep');
jest.mock('../../src/api/scores');
jest.mock('../../src/api/coach');
jest.mock('../../src/lib/windDown');
jest.mock('../../src/api/recaps', () => ({ fetchRecaps: jest.fn(() => Promise.resolve([])), markRecapOpened: jest.fn() }));
jest.mock('../../src/lib/heatmap', () => ({ ...jest.requireActual('../../src/lib/heatmap'), todayCivil: () => '2026-10-08' }));
let mockSyncState = 'idle';
jest.mock('../../src/sync/SyncProvider', () => ({ useSync: () => ({ dataVersion: 0, state: mockSyncState }) }));

const mockNavigation = {
  navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(), replace: jest.fn(),
  addListener: () => () => {},
};
let mockParams: { date?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => mockNavigation,
  useFocusEffect: () => {},
}));

const STATUS: CoachStatusDTO = {
  enabled: true, consented: true, consent: { version: 'v1', summary: 's', dataItems: ['x'] }, personaId: 'mochi', personaChosen: true, personas: [],
};
const sleepFetch = fetchSleep as jest.Mock;
const nightFetch = fetchSleepNight as jest.Mock;
const scoreFetch = fetchScoreDetail as jest.Mock;
const SPOKEN_FORBIDDEN = /[·−]/;
const notFound = () => Object.assign(new Error('not found'), { status: 404 });

function renderScreen(status: CoachStatusDTO | null = STATUS) {
  return render(withCharacter(<SleepScreen />, { characterId: 'mochi', status }));
}
const hero = () => screen.findByTestId('sleep-hero');

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockSyncState = 'idle';
  sleepFetch.mockResolvedValue(makeWindow());
  nightFetch.mockImplementation((d: string) => Promise.resolve(makeDetail(d)));
  scoreFetch.mockImplementation((d: string) => Promise.resolve(makeScore(d)));
  (fetchSleepRegularity as jest.Mock).mockResolvedValue(REGULARITY);
  (fetchSleepGoal as jest.Mock).mockResolvedValue(GOAL);
  (readWindDown as jest.Mock).mockResolvedValue(REMINDER);
});
afterEach(async () => { await act(async () => {}); });

describe('SleepScreen: header and states', () => {
  it('shows the header and the loading skeleton before the nights land', async () => {
    sleepFetch.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId('sleep-loading')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Sleep' })).toBeTruthy();
    expect(screen.getByTestId('sleep-back')).toBeTruthy();
    // The goal and regularity still land while the nights hang; the page stays on its skeleton.
    await act(async () => {});
    expect(screen.getByTestId('sleep-loading')).toBeTruthy();
  });

  it('back, bedtime goal and info buttons', async () => {
    renderScreen();
    await hero();
    fireEvent.press(screen.getByTestId('sleep-back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('sleep-goal-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('BedtimeGoal');
    expect(screen.getByTestId('sleep-goal-button').props.accessibilityLabel).toBe('Bedtime goal');
  });

  it('the info sheet: framing, the weights this night used, baselines without SLEEP, the bands', async () => {
    renderScreen();
    await hero();
    fireEvent.press(screen.getByTestId('sleep-info'));
    const sheet = await screen.findByTestId('sleep-info-sheet');
    expect(within(sheet).getByText(SLEEP_SCORE_FRAMING)).toBeTruthy();
    expect(within(sheet).getByText('This night weighted sleep duration 50, sleep efficiency 30, bedtime consistency 20.')).toBeTruthy();
    // The SLEEP_EFFICIENCY baseline sentence is listed; the SLEEP baseline is filtered out (plan ruling F2).
    expect(within(sheet).getByText('Your sleep efficiency baseline: 92% ± 2%, based on your last 28 days.')).toBeTruthy();
    expect(within(sheet).queryByText(/Your sleep baseline/)).toBeNull();
    expect(within(sheet).getByText('Rough night · Low · under 40')).toBeTruthy();
    expect(within(sheet).getByText('Short night · 1h or more under your goal, on any band')).toBeTruthy();
  });

  it('does not carry the Recaps shelf (it moved to Home)', async () => {
    renderScreen();
    await hero();
    expect(screen.queryByTestId('recap-shelf')).toBeNull();
  });
});

describe('SleepScreen: hero', () => {
  it('opens on the newest night: score, verdict, line, one spoken element', async () => {
    renderScreen();
    const h = await hero();
    expect(within(h).getByText('78')).toBeTruthy();
    expect(within(h).getByText('Restful night')).toBeTruthy();
    expect(h.props.accessibilityLabel).toBe('Sleep score 78, Excellent, restful night. Up 6 from yesterday. High confidence.');
    expect(h.props.accessibilityLabel).not.toMatch(SPOKEN_FORBIDDEN);
    expect(scoreFetch).toHaveBeenCalledWith(TODAY, 'SLEEP');
  });

  it('a past night: Short night overrides the band, the band word stays, the delta names the weekday', async () => {
    mockParams = { date: '2026-10-05' };
    nightFetch.mockResolvedValue(makeDetail('2026-10-05', { minutesAsleep: 302 }));
    scoreFetch.mockResolvedValue(makeScore('2026-10-05', { score: 35 }, { date: '2026-10-04', score: 81 }));
    renderScreen();
    const h = await hero();
    await waitFor(() => expect(within(h).getByText('Short night')).toBeTruthy());
    expect(h.props.accessibilityLabel).toBe('Sleep score 35, Low, short night. Down 46 from Sunday. High confidence.');
  });

  it('Short night on a Good score keeps the band word Good', async () => {
    mockParams = { date: TODAY };
    nightFetch.mockResolvedValue(makeDetail(TODAY, { minutesAsleep: 410 }));
    scoreFetch.mockResolvedValue(makeScore(TODAY, { score: 66 }));
    renderScreen();
    const h = await hero();
    await waitFor(() => expect(within(h).getByText('Short night')).toBeTruthy());
    expect(within(h).getByText('Good')).toBeTruthy();
  });

  it('building: nights counted, the moon dimmed', async () => {
    scoreFetch.mockResolvedValue(makeScore(TODAY, { score: null, coldStart: [{ metric: 'SLEEP_EFFICIENCY', daysCollected: 9, daysRequired: 14 }] }));
    renderScreen();
    const h = await hero();
    await waitFor(() => expect(within(h).getByText('Night 9 of 14')).toBeTruthy());
    expect(within(h).getByText('Learning your sleep')).toBeTruthy();
    expect(within(h).getByText('5 nights to go')).toBeTruthy();
    expect(screen.getByTestId('sleep-hero-moon', { includeHiddenElements: true }).props.style).toMatchObject({ opacity: 0.4 });
  });

  it('a night with no score yet: on its way for last night, none for an older night', async () => {
    scoreFetch.mockResolvedValue(null);
    renderScreen();
    expect(within(await hero()).getByText('Score on its way')).toBeTruthy();
    expect(screen.getByText('It appears a few minutes after your watch syncs')).toBeTruthy();
  });

  it('no night today: waiting, the summary says so, the ask is about missing data', async () => {
    mockParams = { date: TODAY };
    sleepFetch.mockResolvedValue(makeWindow({ nights: makeWindow().nights.filter((n) => n.date !== TODAY) }));
    scoreFetch.mockResolvedValue(null);
    nightFetch.mockRejectedValue(notFound());
    renderScreen();
    const h = await hero();
    await waitFor(() => expect(within(h).getByText('No sleep recorded')).toBeTruthy());
    expect(within(h).getByText("Waiting for last night's data")).toBeTruthy();
    expect(screen.getByText('No sleep recorded for this night.')).toBeTruthy();
    expect(await screen.findByText("Last night isn't in yet.")).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-coach-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach', params: { prefill: "Why don't I have sleep data for last night?" } }, { pop: true });
  });

  it('nap-only: no night in the hero, the nap in the summary', async () => {
    mockParams = { date: '2026-10-07' };
    nightFetch.mockResolvedValue(makeDetail('2026-10-07', { mainIsNap: true, minutesAsleep: 20, bedtime: '14:10', wakeTime: '14:35', hasStages: false, stages: [] }));
    renderScreen();
    const h = await hero();
    await waitFor(() => expect(within(h).getByText('Only a nap was recorded')).toBeTruthy());
    expect(screen.getByText('Only a nap: 20m at 2:10 pm')).toBeTruthy();
  });

  it('low confidence ends the line in the Fair colour', async () => {
    scoreFetch.mockResolvedValue(makeScore(TODAY, { confidenceLevel: 'LOW' }));
    renderScreen();
    // Tests render in the light scheme (as RecoveryScreen.test.tsx:162 does).
    expect(await screen.findByText('Low confidence')).toHaveStyle({ color: COLORS.light.scoreFair });
  });

  it('a night error is one retry card in place of the hero, the summary and the night cards', async () => {
    scoreFetch.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    renderScreen();
    expect(await screen.findByText('This night could not be loaded.')).toBeTruthy();
    expect(screen.queryByTestId('sleep-hero')).toBeNull();
    expect(screen.queryByTestId('sleep-summary')).toBeNull();
    fireEvent.press(screen.getByTestId('sleep-night-retry'));
    expect(await hero()).toBeTruthy();
  });
});

describe('SleepScreen: picker', () => {
  it('seven nights oldest first, Last for today, h:mm, dashes and spoken tabs', async () => {
    renderScreen();
    await hero();
    const dates = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', TODAY];
    for (const d of dates) expect(screen.getByTestId(`sleep-night-${d}`)).toBeTruthy();
    const last = screen.getByTestId(`sleep-night-${TODAY}`);
    expect(within(last).getByText('Last')).toBeTruthy();
    expect(within(last).getByText('7:12')).toBeTruthy();
    expect(last.props.accessibilityRole).toBe('tab');
    expect(last.props.accessibilityState).toMatchObject({ selected: true });
    expect(last.props.accessibilityLabel).toBe('Thursday, last night, 7 hours 12 minutes, Excellent');
    const tue = screen.getByTestId('sleep-night-2026-10-06');
    expect(within(tue).getByText('—')).toBeTruthy();
    expect(tue.props.accessibilityLabel).toBe('Tuesday, no sleep recorded');
    // Wed 7 Oct shows main sleep (418), not the day total with its nap (438).
    expect(within(screen.getByTestId('sleep-night-2026-10-07')).getByText('6:58')).toBeTruthy();
    for (const d of dates) expect(screen.getByTestId(`sleep-night-${d}`).props.accessibilityLabel).not.toMatch(SPOKEN_FORBIDDEN);
  });

  it('a tap selects that night through the route; the selected night is a no-op', async () => {
    renderScreen();
    await hero();
    fireEvent.press(screen.getByTestId('sleep-night-2026-10-05'));
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ date: '2026-10-05' });
    mockNavigation.setParams.mockClear();
    fireEvent.press(screen.getByTestId(`sleep-night-${TODAY}`));
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('an empty past night is still tappable', async () => {
    renderScreen();
    await hero();
    fireEvent.press(screen.getByTestId('sleep-night-2026-10-06'));
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ date: '2026-10-06' });
  });

  it('syncing and backfill captions', async () => {
    mockSyncState = 'syncing';
    sleepFetch.mockResolvedValue(makeWindow({ nights: makeWindow().nights.filter((n) => n.date !== TODAY), stagesBackfillPending: true }));
    renderScreen();
    expect(await screen.findByText("Last night isn't in yet. Syncing…")).toBeTruthy();
    expect(screen.getByText('Reading older nights…')).toBeTruthy();
  });

  it('a nights error has its own retry while the hero still renders', async () => {
    mockParams = { date: TODAY };
    sleepFetch.mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    expect(await screen.findByText('Your nights could not be loaded.')).toBeTruthy();
    expect(await hero()).toBeTruthy();
    fireEvent.press(screen.getByTestId('sleep-window-retry'));
    await waitFor(() => expect(sleepFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId(`sleep-night-${TODAY}`)).toBeTruthy();
  });
});

describe('SleepScreen: summary', () => {
  it('eyebrow, main sleep, caption and line, read as one element', async () => {
    renderScreen();
    // The goal part needs the goal section, which may land after the night.
    await screen.findByText('11:10 pm → 6:52 am · +12m vs your usual · 48m short of your 8h goal');
    const s = screen.getByTestId('sleep-summary');
    expect(within(s).getByText('Last night · Thu 8 Oct')).toBeTruthy();
    expect(within(s).getByText('7h 12m')).toBeTruthy();
    expect(within(s).getByText('asleep')).toBeTruthy();
    expect(within(s).getByText('11:10 pm → 6:52 am · +12m vs your usual · 48m short of your 8h goal')).toBeTruthy();
    expect(s.props.accessibilityLabel).toBe('Night ending Thursday 8 October. 7 hours 12 minutes asleep. 11:10 pm to 6:52 am. 12 minutes more than usual. 48 minutes short of your 8 hour goal.');
  });

  it('naps beside the night', async () => {
    nightFetch.mockResolvedValue(makeDetail(TODAY, { naps: [{ start: '2026-10-08T18:10:00.000Z', end: '2026-10-08T18:35:00.000Z', minutesAsleep: 20 }] }));
    renderScreen();
    expect(await screen.findByText('main sleep · 7h 32m with a nap')).toBeTruthy();
  });

  it('swaps to the newly selected night when the route param changes', async () => {
    const { rerender } = renderScreen();
    await screen.findByText('Last night · Thu 8 Oct');
    mockParams = { date: '2026-10-05' };
    rerender(withCharacter(<SleepScreen />, { characterId: 'mochi', status: STATUS }));
    expect(await screen.findByText('Mon 5 Oct')).toBeTruthy();
    expect(nightFetch).toHaveBeenCalledWith('2026-10-05');
  });
});

describe('SleepScreen: goal row and Ask bar', () => {
  it('the goal row reads the board line and opens BedtimeGoal', async () => {
    renderScreen();
    expect(await screen.findByText('Bed 10:45 pm · Wake 6:45 am · 8h · Reminder 30 min before')).toBeTruthy();
    const row = screen.getByTestId('sleep-goal-row');
    expect(row.props.accessibilityLabel).toBe('Bedtime goal. Bed 10:45 pm, Wake 6:45 am, 8 hours, Reminder 30 min before.');
    fireEvent.press(row);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('BedtimeGoal');
  });

  it('a goal error has its own retry', async () => {
    (fetchSleepGoal as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    fireEvent.press(await screen.findByTestId('sleep-goal-retry'));
    expect(await screen.findByTestId('sleep-goal-row')).toBeTruthy();
  });

  it('asks about last night, and about this night on a past one', async () => {
    renderScreen();
    const bar = await screen.findByTestId('ask-coach-button');
    expect(bar.props.accessibilityLabel).toBe('Ask Mochi about last night');
    fireEvent.press(bar);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach', params: { prefill: 'How was my sleep last night?' } }, { pop: true });
  });

  it('a past night asks about this night', async () => {
    mockParams = { date: '2026-10-05' };
    renderScreen();
    await screen.findByTestId(`sleep-night-${TODAY}`);
    const bar = await screen.findByTestId('ask-coach-button');
    expect(bar.props.accessibilityLabel).toBe('Ask Mochi about this night');
    fireEvent.press(bar);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach', params: { prefill: 'How was my sleep on Monday 5 October?' } }, { pop: true });
  });

  it('the Ask bar is hidden when the coach is off; the info sheet still works', async () => {
    renderScreen({ ...STATUS, enabled: false });
    await hero();
    expect(screen.queryByTestId('ask-coach-button')).toBeNull();
    fireEvent.press(screen.getByTestId('sleep-info'));
    expect(await screen.findByTestId('sleep-info-sheet')).toBeTruthy();
  });
});

describe('SleepScreen: the night in full', () => {
  it('stage lanes, cycles and moments for a night with stages', async () => {
    renderScreen();
    const stages = await screen.findByTestId('sleep-stages-card');
    expect(within(stages).getByText('Sleep stages')).toBeTruthy();
    expect(within(stages).getByTestId('stage-lanes')).toBeTruthy();
    expect(screen.getByTestId('cycles-card')).toBeTruthy();
    expect(screen.getByTestId('moments-card')).toBeTruthy();
  });

  it('without stages: bedtime, wake and the in-bed share instead; no cycles or moments', async () => {
    nightFetch.mockResolvedValue(makeDetail(TODAY, { hasStages: false, stages: [], stageTotals: null, minutesAsleep: 430, minutesInBed: 452 }));
    renderScreen();
    expect(await screen.findByTestId('sleep-in-bed-share')).toHaveTextContent('7h 32m in bed · 95% of it asleep');
    expect(within(screen.getByTestId('sleep-stages-card')).getByText('11:10 pm')).toBeTruthy();
    expect(screen.queryByTestId('cycles-card')).toBeNull();
    expect(screen.queryByTestId('moments-card')).toBeNull();
    expect(screen.getByTestId('sleep-night-numbers')).toBeTruthy();
  });

  it('no in-bed bar without stages when time in bed is zero', async () => {
    nightFetch.mockResolvedValue(makeDetail(TODAY, { hasStages: false, stages: [], stageTotals: null, minutesInBed: 0 }));
    renderScreen();
    await screen.findByTestId('sleep-night-numbers');
    expect(screen.queryByTestId('sleep-stages-card')).toBeNull();
  });

  it('The night: the rows in order, hairlines between, no Sleep score row', async () => {
    renderScreen();
    const card = await screen.findByTestId('sleep-night-numbers');
    for (const [label, value] of [['Time in bed', '7h 32m'], ['Time awake', '14m'], ['Time to fall asleep', '12m'], ['After waking', '6m']]) {
      expect(within(card).getByText(label!)).toBeTruthy();
      expect(within(card).getByText(value!)).toBeTruthy();
    }
    expect(within(card).getByText('None')).toBeTruthy();
    expect(within(card).queryByText('Sleep score')).toBeNull();
  });

  it('hides a null row', async () => {
    nightFetch.mockResolvedValue(makeDetail(TODAY, { minutesAwake: null, minutesAfterWakeUp: null }));
    renderScreen();
    const card = await screen.findByTestId('sleep-night-numbers');
    expect(within(card).queryByText('Time awake')).toBeNull();
    expect(within(card).queryByText('After waking')).toBeNull();
  });

  it('naps on the night clock, newest last, zero-length dropped', async () => {
    // The fixture night is New York in summer (UTC-4): 18:10Z is 2:10 pm, 21:00Z is 5:00 pm.
    nightFetch.mockResolvedValue(makeDetail(TODAY, { naps: [
      { start: '2026-10-08T21:00:00.000Z', end: '2026-10-08T21:15:00.000Z', minutesAsleep: 15 },
      { start: '2026-10-08T18:10:00.000Z', end: '2026-10-08T18:35:00.000Z', minutesAsleep: 20 },
      { start: '2026-10-08T19:00:00.000Z', end: '2026-10-08T19:00:00.000Z', minutesAsleep: 0 },
    ] }));
    renderScreen();
    const naps = await screen.findByTestId('sleep-naps-row');
    const lines = within(naps).getAllByText(/ at /).map((t) => t.props.children);
    expect(lines).toEqual(['20m at 2:10 pm', '15m at 5:00 pm']);
  });

  it('nap-only: the summary names the nap, no stage cards; The night shows the nap row only', async () => {
    mockParams = { date: '2026-10-07' };
    nightFetch.mockResolvedValue(makeDetail('2026-10-07', { mainIsNap: true, minutesAsleep: 20, bedtime: '14:10', wakeTime: '14:35', hasStages: false, stages: [], stageTotals: null, minutesInBed: 25 }));
    renderScreen();
    const card = await screen.findByTestId('sleep-night-numbers');
    expect(within(screen.getByTestId('sleep-summary')).getByText('Only a nap: 20m at 2:10 pm')).toBeTruthy();
    expect(screen.queryByTestId('sleep-stages-card')).toBeNull();
    expect(screen.queryByTestId('cycles-card')).toBeNull();
    expect(screen.queryByTestId('moments-card')).toBeNull();
    expect(within(card).queryByText('Time in bed')).toBeNull();
    expect(within(card).getByText('20m at 2:10 pm')).toBeTruthy();
  });

  it('no night: no night cards at all', async () => {
    mockParams = { date: '2026-10-06' };
    nightFetch.mockRejectedValue(notFound());
    scoreFetch.mockResolvedValue(null);
    renderScreen();
    await screen.findByText('No sleep recorded for this night.');
    expect(screen.queryByTestId('sleep-night-numbers')).toBeNull();
  });

  it('Steps that day opens the Activity tab on that date, back on Tabs rather than a second Tabs (decision 8, ruling F3)', async () => {
    mockParams = { date: '2026-10-05' };
    renderScreen();
    const link = await screen.findByTestId('sleep-steps-that-day');
    // Not exact: the chevron icon renders a glyph into the link's text content.
    expect(link).toHaveTextContent('Steps that day', { exact: false });
    expect(link.props.accessibilityRole).toBe('link');
    fireEvent.press(link);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Activity', params: { date: '2026-10-05' } }, { pop: true });
  });

  it('sits between the summary and the goal row', async () => {
    const { toJSON } = renderScreen();
    await screen.findByTestId('sleep-night-numbers');
    const tree = JSON.stringify(toJSON());
    expect(tree.indexOf('sleep-summary')).toBeLessThan(tree.indexOf('sleep-stages-card'));
    expect(tree.indexOf('sleep-night-numbers')).toBeLessThan(tree.indexOf('sleep-goal-row'));
  });
});

describe('SleepScreen: bedtime to wake', () => {
  const WEEK = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-07', TODAY];
  const chart = () => waitFor(() => expect(screen.getByTestId(`sleep-window-bar-${TODAY}`)).toBeTruthy());

  it('a bar per night in the week, D selected and ringed, the goal band with dashed edges, no averages', async () => {
    renderScreen();
    const card = await screen.findByTestId('sleep-window-card');
    expect(within(card).getByText('Bedtime to wake')).toBeTruthy();
    const range = within(card).getByTestId('sleep-range');
    expect(within(range).getByText('Week')).toBeTruthy();
    expect(within(range).getByText('2 weeks')).toBeTruthy();
    await chart();
    for (const d of WEEK) expect(screen.getByTestId(`sleep-window-bar-${d}`)).toBeTruthy();
    expect(screen.queryByTestId('sleep-window-bar-2026-10-06')).toBeNull();
    const d = screen.getByTestId(`sleep-window-bar-${TODAY}`);
    expect(within(d).getByTestId('sleep-window-selected')).toBeTruthy();
    expect(d.props.accessibilityLabel).toBe('Thursday: 11:08 pm to 6:40 am, selected');
    expect(d.props.accessibilityState).toMatchObject({ selected: true });
    const mon = screen.getByTestId('sleep-window-bar-2026-10-05');
    expect(mon.props.accessibilityLabel).toBe('Monday: 12:50 am to 6:10 am');
    expect(within(mon).queryByTestId('sleep-window-selected')).toBeNull();
    expect(screen.getAllByTestId('sleep-window-selected')).toHaveLength(1);
    expect(screen.queryByTestId('sleep-window-avg-bedtime')).toBeNull();
    expect(screen.queryByTestId('sleep-window-avg-wake')).toBeNull();
    expect(screen.getByTestId('sleep-window-goal-band')).toBeTruthy();
    expect(screen.getByTestId('sleep-window-goal-top')).toBeTruthy();
    expect(screen.getByTestId('sleep-window-goal-bottom')).toBeTruthy();
    expect(screen.getByTestId(`sleep-window-initial-${TODAY}`, { includeHiddenElements: true })).toHaveStyle({ color: COLORS.light.foreground });
    expect(screen.getByTestId('sleep-window-initial-2026-10-07', { includeHiddenElements: true })).not.toHaveStyle({ color: COLORS.light.foreground });
  });

  it('axis ticks read on the app clock (formatClock), not 24-hour (ruling F18)', async () => {
    renderScreen();
    await chart();
    for (const t of ['9:00 pm', '12:00 am', '3:00 am', '6:00 am', '9:00 am']) {
      expect(screen.getByText(t, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.queryByText('21:00', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText('00:00', { includeHiddenElements: true })).toBeNull();
  });

  it('a bar tap selects that night; the selected bar is a no-op', async () => {
    renderScreen();
    await chart();
    fireEvent.press(screen.getByTestId('sleep-window-bar-2026-10-04'));
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ date: '2026-10-04' });
    mockNavigation.setParams.mockClear();
    fireEvent.press(screen.getByTestId(`sleep-window-bar-${TODAY}`));
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('2 weeks shows fourteen days without a refetch', async () => {
    renderScreen();
    await chart();
    fireEvent.press(screen.getByText('2 weeks'));
    const initials = screen.getAllByTestId(/^sleep-window-initial-/, { includeHiddenElements: true });
    expect(initials).toHaveLength(14);
    expect(initials[0]!.props.testID).toBe('sleep-window-initial-2026-09-25');
    expect(initials[13]!.props.testID).toBe(`sleep-window-initial-${TODAY}`);
    expect(sleepFetch).toHaveBeenCalledTimes(1);
  });

  it('a nap-only date is a gap, not a bar (plan ruling 5)', async () => {
    sleepFetch.mockResolvedValue(makeWindow({ nights: [...makeWindow().nights, makeNight('2026-10-06', { mainIsNap: true, bedtime: '14:10', wakeTime: '14:35' })] }));
    renderScreen();
    await chart();
    expect(screen.queryByTestId('sleep-window-bar-2026-10-06')).toBeNull();
  });

  it('no nights: the chart says so', async () => {
    sleepFetch.mockResolvedValue(makeWindow({ nights: [] }));
    renderScreen();
    const card = await screen.findByTestId('sleep-window-card');
    expect(within(card).getByText('No sleep synced yet.')).toBeTruthy();
  });

  it('an old night anchors the week on itself and selects its bar', async () => {
    mockParams = { date: '2026-09-10' };
    sleepFetch.mockResolvedValue(makeWindow({
      nights: ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((d) => makeNight(d)),
    }));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('sleep-window-bar-2026-09-10')).toBeTruthy());
    for (const d of ['2026-09-04', '2026-09-07', '2026-09-10']) expect(screen.getByTestId(`sleep-night-${d}`)).toBeTruthy();
    expect(screen.queryByTestId('sleep-night-2026-09-03')).toBeNull();
    expect(screen.queryByTestId('sleep-night-2026-09-11')).toBeNull();
    expect(within(screen.getByTestId('sleep-window-bar-2026-09-10')).getByTestId('sleep-window-selected')).toBeTruthy();
  });
});

describe('SleepScreen: regularity', () => {
  it('the compact card: label, word and spreads, one spoken element, no drift strip or coach line', async () => {
    renderScreen();
    const card = await screen.findByTestId('sleep-regularity');
    expect(within(card).getByText('Regularity · 7 nights')).toBeTruthy();
    expect(within(card).getByText('Fairly regular')).toBeTruthy();
    expect(within(card).getByText('Bedtime ±24m · Wake ±18m')).toBeTruthy();
    expect(card.props.accessibilityLabel).toBe(regularityA11y(74, 'Fairly regular', 24, 18));
    expect(card.props.accessibilityLabel).not.toMatch(SPOKEN_FORBIDDEN);
    expect(screen.queryByTestId('sleep-drift-strip')).toBeNull();
    expect(screen.queryByTestId('sleep-regularity-coach')).toBeNull();
  });

  it('too few nights: how many more to go', async () => {
    (fetchSleepRegularity as jest.Mock).mockResolvedValue({ ...REGULARITY, nights: 2, score: null, bedtimeSpreadMinutes: null, wakeSpreadMinutes: null });
    renderScreen();
    expect(await screen.findByText('Not enough nights yet. 2 more to go.')).toBeTruthy();
  });

  it('an error has its own retry', async () => {
    (fetchSleepRegularity as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    expect(await screen.findByText('Sleep regularity could not be loaded.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sleep-regularity-retry'));
    expect(await screen.findByTestId('sleep-regularity')).toBeTruthy();
    expect(fetchSleepRegularity).toHaveBeenCalledTimes(2);
  });

  it('the night cards, then bedtime to wake, regularity and the goal row', async () => {
    const { toJSON } = renderScreen();
    await screen.findByTestId('sleep-night-numbers');
    await screen.findByTestId('sleep-window-card');
    await screen.findByTestId('sleep-regularity');
    await screen.findByTestId('sleep-goal-row');
    const tree = JSON.stringify(toJSON());
    expect(tree.indexOf('sleep-night-numbers')).toBeLessThan(tree.indexOf('sleep-window-card'));
    expect(tree.indexOf('sleep-window-card')).toBeLessThan(tree.indexOf('"sleep-regularity"'));
    expect(tree.indexOf('"sleep-regularity"')).toBeLessThan(tree.indexOf('sleep-goal-row'));
  });
});
