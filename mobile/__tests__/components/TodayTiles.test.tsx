import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DailyScoreDTO } from '../../src/api/scores';
import type { SleepNight } from '../../src/api/sleep';
import { AskCoachButton, TodayHeader, TodayTiles, type Read } from '../../src/components/home/TodayTiles';
import { READY } from '../../jest-mocks/forecastFixture';
import { COLORS } from '../../src/theme';

jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'dark' }) }));

const score = (type: 'RECOVERY' | 'SLEEP', value: number | null) =>
  ({ date: '2026-10-13', type, score: value, confidenceLevel: 'HIGH', algorithmVersion: 'v1', factors: [], coldStart: [] }) as DailyScoreDTO;
const night = (minutes: number) => ({ date: '2026-10-13', minutesAsleep: minutes, mainMinutesAsleep: minutes, mainIsNap: false }) as SleepNight;
const ready = <T,>(value: T): Read<T> => ({ status: 'ready', value });
const colour = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).color;

function show(over: Partial<React.ComponentProps<typeof TodayTiles>> = {}) {
  const onOpen = jest.fn();
  render(
    <TodayTiles recovery={ready(score('RECOVERY', 68))} sleepScore={ready(score('SLEEP', 78))} night={ready(night(432))}
      tomorrow={{ status: 'loaded', forecast: READY }} bedtime="23:00" onOpen={onOpen} {...over} />,
  );
  return onOpen;
}

describe('TodayTiles', () => {
  it('shows each value, the verdict in its band colour and the duration, and opens each page', () => {
    const onOpen = show();
    expect(screen.getByTestId('home-tile-recovery-value')).toHaveTextContent('68');
    expect(screen.getByTestId('home-tile-recovery-line')).toHaveTextContent('Mostly clear');
    expect(colour('home-tile-recovery-line')).toBe(COLORS.dark.scoreGood);
    expect(screen.getByTestId('home-tile-sleep-value')).toHaveTextContent('78');
    expect(screen.getByTestId('home-tile-sleep-line')).toHaveTextContent('7h 12m');
    expect(colour('home-tile-sleep-line')).toBe('#C4B5FD');
    expect(screen.getByTestId('home-tile-moon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('home-tile-tomorrow-value')).toHaveTextContent('40–80');
    expect(screen.getByTestId('home-tile-tomorrow-line')).toHaveTextContent('Bed by 23:00');
    for (const key of ['recovery', 'sleep', 'tomorrow'] as const) {
      fireEvent.press(screen.getByTestId(`home-tile-${key}`));
      expect(onOpen).toHaveBeenLastCalledWith(key);
    }
  });

  it('marks a short night in amber', () => {
    show({ night: ready(night(310)) });
    expect(screen.getByTestId('home-tile-sleep-line')).toHaveTextContent('5h 10m · short');
    expect(colour('home-tile-sleep-line')).toBe(COLORS.dark.scoreFair);
  });

  it('reads the default sleep hours without a bedtime goal, and the unlock line without history', () => {
    show({ bedtime: null });
    expect(screen.getByTestId('home-tile-tomorrow-line')).toHaveTextContent('With 7.5h sleep');
    screen.unmount();
    show({ tomorrow: { status: 'loaded', forecast: { status: 'NOT_ENOUGH_DATA', reason: 'NO_HISTORY', daysOfHistory: 3 } as never } });
    expect(screen.getByTestId('home-tile-tomorrow-value')).toHaveTextContent('—');
    expect(screen.getByTestId('home-tile-tomorrow-line')).toHaveTextContent(/Forecast unlocks after/);
  });

  it('shows a skeleton while a tile loads, and "—" when its read failed', () => {
    show({ recovery: { status: 'loading' }, sleepScore: { status: 'loading' }, tomorrow: { status: 'loading' } });
    for (const key of ['recovery', 'sleep', 'tomorrow']) expect(screen.getByTestId(`home-tile-${key}-loading`)).toBeTruthy();
    screen.unmount();
    show({ recovery: { status: 'failed' }, sleepScore: { status: 'failed' }, night: { status: 'failed' }, tomorrow: { status: 'error' } });
    for (const key of ['recovery', 'sleep', 'tomorrow']) expect(screen.getByTestId(`home-tile-${key}-value`)).toHaveTextContent('—');
    expect(screen.getByTestId('home-tile-recovery-line')).toHaveTextContent('—');
    expect(screen.getByTestId('home-tile-sleep-line')).toHaveTextContent('—');
  });

  it('shows "Learning your weather" for a null Recovery score', () => {
    show({ recovery: ready(score('RECOVERY', null)) });
    expect(screen.getByTestId('home-tile-recovery-value')).toHaveTextContent('—');
    expect(screen.getByTestId('home-tile-recovery-line')).toHaveTextContent('Learning your weather');
  });
});

describe('TodayHeader', () => {
  it('words the hint per state, in its colour', () => {
    render(<TodayHeader scene="night" bedtime="23:00" />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByTestId('home-today-hint')).toHaveTextContent('Wind down · bed by 23:00');
    expect(colour('home-today-hint')).toBe('#C4B5FD');
    screen.unmount();
    render(<TodayHeader scene="short" bedtime={null} />);
    expect(screen.getByTestId('home-today-hint')).toHaveTextContent('Short night overrides KIP’s mood');
    expect(colour('home-today-hint')).toBe(COLORS.dark.scoreFair);
    screen.unmount();
    render(<TodayHeader scene="clear" bedtime={null} />);
    expect(screen.getByTestId('home-today-hint')).toHaveTextContent('Tap the scene or a tile');
    expect(colour('home-today-hint')).toBe(COLORS.dark.muted);
  });
});

describe('AskCoachButton', () => {
  it('is hidden without a route, and words the consent case', () => {
    const { rerender } = render(<AskCoachButton route={null} onPress={jest.fn()} />);
    expect(screen.queryByTestId('coach-entry-button')).toBeNull();
    const onPress = jest.fn();
    rerender(<AskCoachButton route="CoachConsent" onPress={onPress} />);
    expect(screen.getByText('Ask Coach · see what’s shared first')).toBeTruthy();
    rerender(<AskCoachButton route="Coach" onPress={onPress} />);
    fireEvent.press(screen.getByText('Ask Coach about today'));
    expect(onPress).toHaveBeenCalled();
  });
});
