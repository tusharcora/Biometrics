import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { RecoveryScreen } from '../../src/screens/RecoveryScreen';
import { fetchRecoveryPage, type RecoveryPageDTO } from '../../src/api/recovery';
import type { CoachStatusDTO } from '../../src/api/coach';
import { RECOVERY_COPY } from '../../src/lib/recoveryCopy';
import { COLORS } from '../../src/theme';
import { makePage } from '../fixtures/recoveryPage';

jest.mock('../../src/api/recovery');
jest.mock('../../src/api/coach');
jest.mock('../../src/sync/SyncProvider', () => ({ useSync: () => ({ dataVersion: 0 }) }));

const mockNavigation = {
  navigate: jest.fn(),
  push: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  replace: jest.fn(),
  addListener: () => () => {},
};
let mockParams: { date?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => mockNavigation,
  useFocusEffect: () => {},
}));

const STATUS: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'mochi',
  personaChosen: true,
  personas: [],
};

const pageFetch = fetchRecoveryPage as jest.Mock;

function renderScreen(status: CoachStatusDTO | null = STATUS) {
  return render(withCharacter(<RecoveryScreen />, { characterId: 'mochi', status }));
}

function pending<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  pageFetch.mockResolvedValue(makePage());
});

describe('RecoveryScreen: states', () => {
  it('shows the loading skeleton under the header before the first page', () => {
    pageFetch.mockReturnValue(pending<RecoveryPageDTO>().promise);
    renderScreen();

    expect(screen.getByTestId('recovery-loading')).toBeTruthy();
    expect(screen.getByTestId('recovery-back')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Recovery' })).toBeTruthy();
  });

  it('shows the error with Try again, which fetches again', async () => {
    pageFetch.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    renderScreen();

    expect(await screen.findByText("Couldn't load your recovery.")).toBeTruthy();
    expect(screen.getByTestId('recovery-error')).toBeTruthy();
    expect(pageFetch).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(pageFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('recovery-hero')).toBeTruthy();
  });

  it('maps a 400 to the future-day error without Try again', async () => {
    pageFetch.mockRejectedValueOnce(Object.assign(new Error('bad date'), { status: 400 }));
    renderScreen();

    expect(await screen.findByText("That day hasn't happened yet.")).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });
});

describe('RecoveryScreen: READY', () => {
  it('shows the hero numeral, verdict, band and line, and the summary', async () => {
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    expect(within(hero).getByText('68')).toBeTruthy();
    expect(within(hero).getByText('Mostly clear')).toBeTruthy();
    expect(within(hero).getByText('Good')).toBeTruthy();
    expect(within(hero).getByText('Good · +6 vs yesterday · High confidence')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-summary')).getByText(
      'A warm front in your HRV is lifting you today. Sleep-debt fog lingers; an early night clears it.',
    )).toBeTruthy();
  });

  it('colours the band word in the band colour and leaves High confidence muted', async () => {
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    expect(within(hero).getByText('Good')).toHaveStyle({ color: COLORS.light.scoreGood });
    expect(within(hero).getByText('High confidence')).not.toHaveStyle({ color: COLORS.light.scoreFair });
  });

  it('labels the hero as one element', async () => {
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    const label = RECOVERY_COPY.heroA11y(68, 'Good', 'Mostly clear', ' · +6 vs yesterday · High confidence');
    expect(label).toBe('Recovery 68, Good, mostly clear. · +6 vs yesterday · High confidence');
    expect(hero.props.accessible).toBe(true);
    expect(hero.props.accessibilityLabel).toBe(label);
  });

  it('shows the date and update time under the title', async () => {
    renderScreen();

    expect((await screen.findByTestId('recovery-subtitle')).props.children).toMatch(/^Thu 8 Oct · updated /);
  });

  it('goes back from the back button', async () => {
    renderScreen();
    await screen.findByTestId('recovery-hero');

    fireEvent.press(screen.getByTestId('recovery-back'));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('opens the info sheet with the weights, baselines and the four bands', async () => {
    renderScreen();
    await screen.findByTestId('recovery-hero');
    expect(screen.queryByTestId('recovery-info-sheet')).toBeNull();

    fireEvent.press(screen.getByTestId('recovery-info'));
    const sheet = screen.getByTestId('recovery-info-sheet');

    expect(within(sheet).getByText('How the score works')).toBeTruthy();
    expect(within(sheet).getByText(/weighted 45 \/ 35 \/ 20\.$/)).toBeTruthy();
    expect(within(sheet).getByText(/not a medical assessment/)).toBeTruthy();
    expect(within(sheet).getByText(/^Your HRV baseline: /)).toBeTruthy();
    expect(within(sheet).getByText(/^Your resting heart rate baseline: /)).toBeTruthy();
    for (const line of ['Clear skies · Excellent · 75 and up', 'Mostly clear · Good · 55–74', 'Cloudy · Fair · 40–54', 'Stormy · Low · under 40']) {
      expect(within(sheet).getByText(line)).toBeTruthy();
    }
  });

  it('colours Low confidence in the Fair colour and adds the rough-read sentence', async () => {
    const base = makePage();
    pageFetch.mockResolvedValue(makePage({ score: { ...base.score!, confidenceLevel: 'LOW' } }));
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    expect(within(hero).getByText(/ · Low confidence$/)).toBeTruthy();
    expect(within(hero).getByText('Low confidence')).toHaveStyle({ color: COLORS.light.scoreFair });
    expect(within(screen.getByTestId('recovery-summary')).getByText(/Some readings are missing, so treat today as a rough read\.$/)).toBeTruthy();
  });

  it('reads a past day in the past tense, with no update time', async () => {
    mockParams = { date: '2026-10-02' };
    pageFetch.mockResolvedValue(makePage({ date: '2026-10-02', isToday: false, previous: { date: '2026-10-01', score: 71 } }));
    renderScreen();

    expect(await screen.findByTestId('recovery-subtitle')).toHaveTextContent('Fri 2 Oct', { exact: true });
    expect(pageFetch).toHaveBeenCalledWith('2026-10-02');
    expect(within(screen.getByTestId('recovery-summary')).getByText(
      'A warm front in your HRV lifted you that day. Sleep-debt fog lingered; an early night would have cleared it.',
    )).toBeTruthy();
  });
});

describe('RecoveryScreen: building and no data', () => {
  it('shows cold-start progress and the building summary', async () => {
    const base = makePage();
    pageFetch.mockResolvedValue(makePage({
      state: 'BUILDING',
      previous: null,
      score: { ...base.score!, score: null, factors: [], coldStart: [{ metric: 'HRV', daysCollected: 9, daysRequired: 14 }] },
    }));
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    expect(within(hero).getByText('Day 9 of 14')).toBeTruthy();
    expect(within(hero).getByText('Learning your weather')).toBeTruthy();
    expect(within(hero).getByText('Your forecast is charging up · 5 days to go')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-summary')).getByText(
      'We need 5 more days of HRV to read your weather. Keep wearing your watch to bed.',
    )).toBeTruthy();
  });

  it('shows No reading today, with no summary', async () => {
    pageFetch.mockResolvedValue(makePage({ state: 'NO_DATA', score: null, previous: null, updatedAt: null }));
    renderScreen();
    const hero = await screen.findByTestId('recovery-hero');

    expect(within(hero).getByText('—')).toBeTruthy();
    expect(within(hero).getByText('No reading')).toBeTruthy();
    expect(within(hero).getByText("Waiting for last night's data")).toBeTruthy();
    expect(screen.queryByTestId('recovery-summary')).toBeNull();
    expect(screen.getByTestId('recovery-subtitle')).toHaveTextContent('Thu 8 Oct', { exact: true });
  });
});

describe('RecoveryScreen: Ask bar', () => {
  it("asks the coach about today with the recovery prefill", async () => {
    renderScreen();
    const bar = await screen.findByTestId('ask-coach-button');

    expect(bar.props.accessibilityLabel).toBe('Ask Mochi about today');
    fireEvent.press(bar);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Tabs',
      { screen: 'Coach', params: { prefill: 'Why is my recovery where it is today?' } },
      { pop: true },
    );
  });

  it('asks about this day on a past day', async () => {
    mockParams = { date: '2026-10-02' };
    pageFetch.mockResolvedValue(makePage({ date: '2026-10-02', isToday: false }));
    renderScreen();

    expect((await screen.findByTestId('ask-coach-button')).props.accessibilityLabel).toBe('Ask Mochi about this day');
  });

  it('is hidden when the coach is disabled', async () => {
    renderScreen({ ...STATUS, enabled: false });
    await screen.findByTestId('recovery-hero');

    expect(screen.queryByTestId('ask-coach-button')).toBeNull();
  });
});
