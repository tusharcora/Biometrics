import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { withCharacter } from '../../jest-mocks/characterContext';
import { SleepNightScreen } from '../../src/screens/SleepNightScreen';
import { fetchSleepNight, type SleepNightDetail } from '../../src/api/sleep';
import { ApiError } from '../../src/api/client';

jest.mock('../../src/api/sleep');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { date: '2026-10-01' } }),
}));

// Synthetic values only.
const DETAIL: SleepNightDetail = {
  date: '2026-10-01',
  bedtime: '23:10',
  wakeTime: '07:00',
  minutesAsleep: 400,
  minutesInBed: 470,
  minutesAwake: 50,
  minutesToFallAsleep: 12,
  minutesAfterWakeUp: 8,
  hasStages: true,
  stages: [
    { type: 'LIGHT', start: '2026-09-30T23:22:00.000Z', end: '2026-10-01T01:22:00.000Z' },
    { type: 'DEEP', start: '2026-10-01T01:22:00.000Z', end: '2026-10-01T02:42:00.000Z' },
    { type: 'AWAKE', start: '2026-10-01T02:42:00.000Z', end: '2026-10-01T03:32:00.000Z' },
    { type: 'REM', start: '2026-10-01T03:32:00.000Z', end: '2026-10-01T05:12:00.000Z' },
  ],
  stageTotals: {
    deep: { minutes: 80, count: 2 },
    light: { minutes: 220, count: 4 },
    rem: { minutes: 100, count: 3 },
    awake: { minutes: 47, count: 5 },
  },
  naps: [
    { start: '2026-10-01T13:00:00.000Z', end: '2026-10-01T13:30:00.000Z', minutesAsleep: 25 },
    // A zero-length nap the backend can emit in rare cases is dropped.
    { start: '2026-10-01T16:00:00.000Z', end: '2026-10-01T16:00:00.000Z', minutesAsleep: 0 },
  ],
  sleepScore: 76,
  usualMinutesAsleep: 388,
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchSleepNight as jest.Mock).mockResolvedValue(DETAIL);
});

afterEach(async () => {
  await act(async () => {});
});

function renderScreen() {
  return render(withCharacter(<SleepNightScreen />, { characterId: 'luna' }));
}

describe('SleepNightScreen', () => {
  it('fetches the night from the route and shows the date and time asleep', async () => {
    renderScreen();

    expect(await screen.findByTestId('night-header')).toHaveTextContent(/Thursday 1 October/);
    expect(screen.getByTestId('night-header')).toHaveTextContent(/6h 40m/);
    expect(fetchSleepNight).toHaveBeenCalledWith('2026-10-01');
  });

  it('draws the stage strip with bedtime and wake at its ends, and a legend', async () => {
    renderScreen();

    const strip = await screen.findByTestId('night-stage-strip');
    expect(within(strip).getByTestId('stage-strip')).toBeTruthy();
    expect(strip).toHaveTextContent(/11:10 pm/);
    expect(strip).toHaveTextContent(/7:00 am/);
    expect(screen.getByTestId('stage-legend')).toBeTruthy();
  });

  it('breaks the night down by stage: minutes, percentage and count', async () => {
    renderScreen();

    await screen.findByTestId('night-breakdown-deep');
    // Deep, light and REM are shares of time asleep (400 min).
    expect(screen.getByTestId('night-breakdown-deep')).toHaveTextContent(/Deep.*1h 20m.*20%.*2 times/);
    expect(screen.getByTestId('night-breakdown-light')).toHaveTextContent(/Light.*3h 40m.*55%.*4 times/);
    expect(screen.getByTestId('night-breakdown-rem')).toHaveTextContent(/REM.*1h 40m.*25%.*3 times/);
    // Awake is a share of time in bed (470 min): 47 / 470 = 10%.
    expect(screen.getByTestId('night-breakdown-awake')).toHaveTextContent(/Awake.*47m.*10%.*5 times/);
  });

  it('lists the night numbers and the difference from the usual night', async () => {
    renderScreen();

    const numbers = await screen.findByTestId('night-numbers');
    expect(numbers).toHaveTextContent(/Time in bed.*7h 50m/);
    expect(numbers).toHaveTextContent(/Time awake.*50m/);
    expect(numbers).toHaveTextContent(/Time to fall asleep.*12m/);
    expect(numbers).toHaveTextContent(/Time after waking.*8m/);
    expect(numbers).toHaveTextContent(/Sleep score.*76/);
    expect(numbers).toHaveTextContent(/\+12m vs usual/);
  });

  it('shows a shorter night than usual with a minus sign', async () => {
    (fetchSleepNight as jest.Mock).mockResolvedValue({ ...DETAIL, usualMinutesAsleep: 408 });
    renderScreen();

    expect(await screen.findByTestId('night-numbers')).toHaveTextContent(/−8m vs usual/);
  });

  it('omits the comparison without a usual night', async () => {
    (fetchSleepNight as jest.Mock).mockResolvedValue({ ...DETAIL, usualMinutesAsleep: null });
    renderScreen();

    expect(await screen.findByTestId('night-numbers')).not.toHaveTextContent(/vs usual/);
  });

  it('lists naps, dropping zero-length ones', async () => {
    renderScreen();

    const naps = await screen.findByTestId('night-naps');
    expect(within(naps).getAllByText(/^Nap · /)).toHaveLength(1);
    expect(within(naps).getByText('Nap · 25m')).toBeTruthy();
  });

  it('hides the naps section when there are none', async () => {
    (fetchSleepNight as jest.Mock).mockResolvedValue({ ...DETAIL, naps: [] });
    renderScreen();

    await screen.findByTestId('night-numbers');
    expect(screen.queryByTestId('night-naps')).toBeNull();
  });

  it('asks the coach about this night with the question prefilled, not sent', async () => {
    renderScreen();

    const ask = await screen.findByTestId('night-ask-coach');
    expect(ask).toHaveTextContent('Ask Luna about this night');
    fireEvent.press(ask);

    expect(mockNavigate).toHaveBeenCalledWith(
      'Tabs',
      { screen: 'Coach', params: { prefill: 'How was my sleep on Thursday 1 October?' } },
      { pop: true },
    );
  });

  it('shows the asleep/in-bed bar instead of stages when the night has none', async () => {
    (fetchSleepNight as jest.Mock).mockResolvedValue({ ...DETAIL, hasStages: false, stages: [], stageTotals: null });
    renderScreen();

    expect(await screen.findByTestId('night-no-stages')).toHaveTextContent('7h 50m in bed · 85% of it asleep');
    expect(screen.queryByTestId('night-stage-strip')).toBeNull();
    expect(screen.queryByTestId('night-breakdown-deep')).toBeNull();
    expect(screen.queryByTestId('night-breakdown-awake')).toBeNull();
  });

  it('says so when there is no night for the date', async () => {
    (fetchSleepNight as jest.Mock).mockRejectedValue(new ApiError(404, 'not found', 'not_found'));
    renderScreen();

    expect(await screen.findByText('No sleep recorded for this night.')).toBeTruthy();
    expect(screen.queryByTestId('night-retry')).toBeNull();
  });

  it('offers a retry on any other failure, and recovers', async () => {
    (fetchSleepNight as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderScreen();

    fireEvent.press(await screen.findByTestId('night-retry'));

    expect(await screen.findByTestId('night-numbers')).toBeTruthy();
    expect(fetchSleepNight).toHaveBeenCalledTimes(2);
  });
});
