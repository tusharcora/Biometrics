import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { TodayBarDTO, TodaySummaryDTO } from '../../src/api/coach';
import { CoachToday } from '../../src/components/coach/CoachToday';
import { TodayBar } from '../../src/components/coach/TodayBar';
import { barQuestion, spanQuestion } from '../../src/lib/coachToday';
import { COLORS } from '../../src/theme';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockScheme, setColorScheme: jest.fn(), toggleColorScheme: jest.fn() }),
}));

const style = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const recovery: TodayBarDTO = {
  metric: 'recovery',
  label: 'Recovery',
  value: 26,
  usual: 58,
  unit: 'score',
  display: '26',
  usualDisplay: '58',
  status: 'below',
  scaleMax: 100,
};
const sleep: TodayBarDTO = {
  metric: 'sleep',
  label: 'Sleep',
  value: 408,
  usual: 433,
  unit: 'minutes',
  display: '6h 48m',
  usualDisplay: '7h 13m',
  status: 'near',
  scaleMax: 606.2,
};
const hrv: TodayBarDTO = { ...recovery, metric: 'hrv', label: 'HRV', value: 63, usual: 52, unit: 'ms', display: '63', usualDisplay: '52', status: 'above', scaleMax: 88.2 };
const rhr: TodayBarDTO = { ...recovery, metric: 'rhr', label: 'Rest HR', value: 58, usual: 58, unit: 'bpm', display: '58', usualDisplay: '58', status: 'near', scaleMax: 81.2 };

const summary: TodaySummaryDTO = {
  date: '2026-09-30',
  hasData: true,
  sentence: {
    text: "Recovery's 26, about half your usual. A short night pulled your HRV down.",
    spans: [
      { text: "Recovery's " },
      { text: '26', metric: 'recovery' },
      { text: ', about half your usual. A ' },
      { text: 'short night', metric: 'sleep' },
      { text: ' pulled your HRV down.' },
    ],
    source: 'ai',
  },
  bars: [recovery, sleep, hrv, rhr],
};

beforeEach(() => {
  mockScheme = 'light';
});

describe('TodayBar', () => {
  it('fills to the value on its scale, ticks the usual, and reads "value / usual N"', () => {
    const { getByTestId } = render(<TodayBar bar={recovery} onPress={() => {}} />);

    expect(style(getByTestId('today-bar-fill-recovery')).width).toBe('26%');
    expect(style(getByTestId('today-bar-tick-recovery')).left).toBe('58%');
    expect(getByTestId('today-bar-recovery')).toHaveTextContent('Recovery26 / usual 58');
  });

  it('colours by status: rose below, teal above, neutral near, violet for sleep near usual', () => {
    const colours = [recovery, hrv, rhr, sleep].map((bar) => {
      const { getByTestId, unmount } = render(<TodayBar bar={bar} onPress={() => {}} />);
      const colour = style(getByTestId(`today-bar-fill-${bar.metric}`)).backgroundColor;
      unmount();
      return colour;
    });
    expect(colours).toEqual([COLORS.light.statusBelow, COLORS.light.statusAbove, COLORS.light.statusNear, COLORS.light.metricSleep]);
  });

  it('uses the dark palette in dark mode', () => {
    mockScheme = 'dark';
    const { getByTestId } = render(<TodayBar bar={recovery} onPress={() => {}} />);

    expect(style(getByTestId('today-bar-fill-recovery')).backgroundColor).toBe(COLORS.dark.statusBelow);
    expect(style(getByTestId('today-bar-tick-recovery')).backgroundColor).toBe(COLORS.dark.todayTick);
  });

  it('draws the usual tick taller than the track so it shows over any fill (R36)', () => {
    const { getByTestId } = render(<TodayBar bar={{ ...recovery, value: 90 }} onPress={() => {}} />);
    const tick = getByTestId('today-bar-tick-recovery');
    const track = getByTestId('today-bar-track-recovery');

    expect(style(tick).height as number).toBeGreaterThan(style(track).height as number);
  });

  it('never colours the small value text with a status colour in light mode (R35)', () => {
    const { getByTestId } = render(<TodayBar bar={recovery} onPress={() => {}} />);

    expect(style(getByTestId('today-bar-value-recovery')).color).toBe(COLORS.light.foreground);
  });

  it('says higher or lower by the number for resting HR, and near as about usual', () => {
    const rhrHigh = { ...rhr, value: 66, display: '66', status: 'below' as const };
    const a = render(<TodayBar bar={rhrHigh} onPress={() => {}} />);
    expect(a.getByTestId('today-bar-rhr').props.accessibilityLabel).toBe('Rest HR 66, usual 58. Higher than usual.');
    a.unmount();
    const b = render(<TodayBar bar={sleep} onPress={() => {}} />);
    expect(b.getByTestId('today-bar-sleep').props.accessibilityLabel).toBe('Sleep 6h 48m, usual 7h 13m. About usual.');
  });

  it('draws no tick when there is no usual yet', () => {
    const { queryByTestId, getByTestId } = render(<TodayBar bar={{ ...recovery, usual: null, usualDisplay: null, status: null }} onPress={() => {}} />);

    expect(queryByTestId('today-bar-tick-recovery')).toBeNull();
    expect(getByTestId('today-bar-recovery')).toHaveTextContent('Recovery26');
  });

  it('is a button that says what it shows and passes itself to onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<TodayBar bar={recovery} onPress={onPress} />);
    const button = getByTestId('today-bar-recovery');

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Recovery 26, usual 58. Lower than usual.');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledWith(recovery);
  });
});

describe('CoachToday', () => {
  it('shows the sentence with the metric words underlined, the four bars and the footnote', () => {
    const { getByTestId, getAllByTestId } = render(<CoachToday summary={summary} loading={false} onAsk={() => {}} />);

    expect(getByTestId('coach-today-sentence')).toHaveTextContent(summary.sentence!.text);
    expect(style(getByTestId('today-span-recovery')).textDecorationLine).toBe('underline');
    expect(style(getByTestId('today-span-recovery')).color).toBe(COLORS.light.statusBelow);
    expect(getAllByTestId(/^today-bar-(recovery|sleep|hrv|rhr)$/)).toHaveLength(4);
    expect(getByTestId('coach-today-footnote')).toHaveTextContent('Comparisons against your own readings, not medical advice.');
  });

  it('asks about a bar when it is tapped, worded by its status', () => {
    const onAsk = jest.fn();
    const { getByTestId } = render(<CoachToday summary={summary} loading={false} onAsk={onAsk} />);

    fireEvent.press(getByTestId('today-bar-recovery'));
    fireEvent.press(getByTestId('today-bar-hrv'));
    fireEvent.press(getByTestId('today-bar-sleep'));

    // R37: the wording is coachToday.ts's, so assert against it.
    expect(onAsk.mock.calls).toEqual([[barQuestion(recovery)], [barQuestion(hrv)], [barQuestion(sleep)]]);
    expect(onAsk.mock.calls[0]).toEqual(['Why is my recovery lower than usual today?']);
  });

  it('asks about an underlined word when it is tapped', () => {
    const onAsk = jest.fn();
    const { getByTestId } = render(<CoachToday summary={summary} loading={false} onAsk={onAsk} />);
    const span = getByTestId('today-span-sleep');

    expect(span.props.accessibilityRole).toBe('button');
    fireEvent.press(span);

    expect(onAsk).toHaveBeenCalledWith(spanQuestion('sleep', summary.bars));
  });

  it('shows the bars without a sentence when the server sends none', () => {
    const { getByTestId, queryByTestId } = render(<CoachToday summary={{ ...summary, sentence: null }} loading={false} onAsk={() => {}} />);

    expect(queryByTestId('coach-today-sentence')).toBeNull();
    expect(getByTestId('coach-today-bars')).toBeTruthy();
    expect(getByTestId('coach-today-footnote')).toBeTruthy();
  });

  it('shows skeleton bars while loading', () => {
    const { getByTestId, queryByTestId } = render(<CoachToday summary={null} loading onAsk={() => {}} />);

    expect(getByTestId('coach-today-loading')).toBeTruthy();
    expect(queryByTestId('coach-today-sentence')).toBeNull();
  });

  it('keeps showing the last summary while it refreshes', () => {
    const { getByTestId, queryByTestId } = render(<CoachToday summary={summary} loading onAsk={() => {}} />);

    expect(getByTestId('coach-today-sentence')).toBeTruthy();
    expect(queryByTestId('coach-today-loading')).toBeNull();
  });

  it('says what will appear, with no bars, before the first night syncs', () => {
    const { getByTestId, queryByTestId } = render(
      <CoachToday summary={{ date: '2026-09-30', hasData: false, sentence: null, bars: [] }} loading={false} onAsk={() => {}} />,
    );

    expect(getByTestId('coach-today-empty')).toHaveTextContent("Once your first night syncs, I'll sum up your day here.");
    expect(queryByTestId('today-bar-recovery')).toBeNull();
    expect(queryByTestId('coach-today-footnote')).toBeNull();
  });

  it('shows nothing when the summary could not be loaded', () => {
    const { toJSON } = render(<CoachToday summary={null} loading={false} onAsk={() => {}} />);

    expect(toJSON()).toBeNull();
  });
});
