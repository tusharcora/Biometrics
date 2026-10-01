import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Circle, Rect } from 'react-native-svg';
import { ActivityHeatmap, type SleepState } from '../../src/components/activity-heatmap';
import type { SleepNight } from '../../src/api/sleep';
import { COLORS } from '../../src/theme';

const TODAY = '2026-09-22';

const NO_SLEEP: SleepState = { phase: 'ready', nights: new Map(), earliestDate: '2025-01-01' };

function nightOf(date: string, minutesAsleep: number, extra: Partial<SleepNight> = {}): [string, SleepNight] {
  return [date, { date, minutesAsleep, minutesInBed: null, bedtime: null, wakeTime: null, sleepScore: null, ...extra }];
}

function sleepOf(nights: [string, SleepNight][], earliestDate: string | null = '2025-01-01'): SleepState {
  return { phase: 'ready', nights: new Map(nights), earliestDate };
}

function renderHeatmap(
  steps: [string, number][],
  earliestDate: string | null = '2025-01-01',
  sleep: SleepState = NO_SLEEP,
  onRetrySleep?: () => void,
) {
  const utils = render(
    <ActivityHeatmap steps={new Map(steps)} earliestDate={earliestDate} today={TODAY} sleep={sleep} onRetrySleep={onRetrySleep} />,
  );
  // The grid is sized from the measured width; 350 gives 50 dp month bins.
  fireEvent(utils.getByTestId('heatmap-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 300 } } });
  if (sleep.phase === 'ready') {
    fireEvent(utils.getByTestId('sleep-heatmap-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 300 } } });
  }
  return utils;
}

// September 2026 starts on a Tuesday, so with 50 dp bins the 22nd sits in
// column 2 of row 3.
const SEP_22 = { locationX: 2 * 50 + 25, locationY: 3 * 50 + 25 };

describe('ActivityHeatmap', () => {
  it("opens on the current month's calendar", () => {
    const { getByTestId } = renderHeatmap([]);

    expect(getByTestId('heatmap-title')).toHaveTextContent('September 2026');
    expect(getByTestId('heatmap-grid')).toBeTruthy();
  });

  it('opens a day sheet with steps, percent of goal and a comparison when a day is tapped', () => {
    const { getByTestId } = renderHeatmap([
      [`2026-09-21`, 8000],
      [`2026-09-22`, 12000],
    ]);

    fireEvent.press(getByTestId('heatmap-grid'), { nativeEvent: SEP_22 });

    const sheet = within(getByTestId('day-detail'));
    expect(sheet.getByText('Tue, Sep 22, 2026')).toBeTruthy();
    expect(getByTestId('day-detail-steps')).toHaveTextContent('12,000 steps');
    expect(getByTestId('day-detail-goal')).toHaveTextContent('120% of your 10,000-step goal');
    expect(getByTestId('day-detail-comparison')).toHaveTextContent('20% above your average for this range.');
  });

  it('says so when a tapped day has no record', () => {
    const { getByTestId } = renderHeatmap([]);

    fireEvent.press(getByTestId('heatmap-grid'), { nativeEvent: SEP_22 });

    expect(getByTestId('day-detail-empty')).toHaveTextContent('No steps were recorded for this day.');
  });

  it('ignores taps on blank positions', () => {
    const { getByTestId, queryByTestId } = renderHeatmap([]);

    fireEvent.press(getByTestId('heatmap-grid'), { nativeEvent: { locationX: 10, locationY: 10 } });

    expect(queryByTestId('day-detail')).toBeNull();
  });

  it('pages back through months but not into the future', () => {
    const { getByTestId } = renderHeatmap([]);

    expect(getByTestId('heatmap-next-month')).toBeDisabled();
    fireEvent.press(getByTestId('heatmap-prev-month'));
    expect(getByTestId('heatmap-title')).toHaveTextContent('August 2026');
    fireEvent.press(getByTestId('heatmap-next-month'));
    expect(getByTestId('heatmap-title')).toHaveTextContent('September 2026');
  });

  it('stops paging back at the month a year ago', () => {
    const { getByTestId } = renderHeatmap([]);

    for (let i = 0; i < 20; i++) fireEvent.press(getByTestId('heatmap-prev-month'));

    expect(getByTestId('heatmap-title')).toHaveTextContent('September 2025');
    expect(getByTestId('heatmap-prev-month')).toBeDisabled();
  });

  it('switches to the year and year-to-date views', () => {
    const { getByTestId, queryByTestId } = renderHeatmap([]);

    fireEvent.press(getByTestId('heatmap-view-year'));
    expect(getByTestId('heatmap-title')).toHaveTextContent('Last 12 months');
    expect(queryByTestId('heatmap-prev-month')).toBeNull();

    fireEvent.press(getByTestId('heatmap-view-ytd'));
    expect(getByTestId('heatmap-title')).toHaveTextContent('2026 year to date');
  });

  it('shows stats for the visible range', () => {
    const { getByTestId } = renderHeatmap([
      ['2026-08-31', 50000], // outside September
      ['2026-09-19', 10000],
      ['2026-09-20', 11000],
      ['2026-09-21', 12000],
      ['2026-09-22', 3000],
    ]);

    expect(getByTestId('stat-total')).toHaveTextContent('36,000');
    expect(getByTestId('stat-average')).toHaveTextContent('9,000');
    expect(getByTestId('stat-active')).toHaveTextContent('4');
    expect(getByTestId('stat-streak')).toHaveTextContent('3 days');
    expect(getByTestId('stat-best')).toHaveTextContent('12,000 · Sep 21');

    // The year view's range includes August 31st.
    fireEvent.press(getByTestId('heatmap-view-year'));
    expect(getByTestId('stat-total')).toHaveTextContent('86,000');
  });

  it('is honest about history that has not synced yet', () => {
    const syncing = renderHeatmap([], null);
    expect(syncing.getByTestId('heatmap-history-note')).toHaveTextContent('Your step history is still syncing.');
    syncing.unmount();

    const partial = renderHeatmap([['2026-09-20', 5000]], '2026-09-20');
    fireEvent.press(partial.getByTestId('heatmap-view-year'));
    expect(partial.getByTestId('heatmap-history-note')).toHaveTextContent(/^Only 3 days of history so far/);
  });

  it('describes the grid as one accessible element', () => {
    const { getByTestId } = renderHeatmap([['2026-09-22', 12000]]);

    expect(getByTestId('heatmap-grid').props.accessibilityLabel).toBe(
      'Steps heat map for September 2026: 1 active days, 1 at goal.',
    );
  });
  describe('cell shape', () => {
    it('draws the month as rounded squares, not circles', () => {
      const utils = renderHeatmap([['2026-09-21', 8000]]);

      expect(utils.UNSAFE_queryAllByType(Circle)).toHaveLength(0);
      const squares = within(utils.getByTestId('heatmap-canvas')).UNSAFE_getAllByType(Rect);
      // One square per day through today, the 22nd; later days are not drawn.
      expect(squares).toHaveLength(22);
      // 50 dp bins minus the 6 dp gap; corners scale with the square.
      expect(squares[0]!.props.width).toBe(44);
      expect(squares[0]!.props.height).toBe(44);
      expect(squares[0]!.props.rx).toBe(6);
    });

    it('grows the tapped day to fill its bin while its sheet is open', () => {
      const utils = renderHeatmap([['2026-09-22', 12000]]);

      fireEvent.press(utils.getByTestId('heatmap-grid'), { nativeEvent: SEP_22 });

      const grown = utils.UNSAFE_getAllByType(Rect).filter((r) => r.props.width === 47);
      expect(grown).toHaveLength(1);
    });

    it('keeps the year view on small squares with 2 dp corners', () => {
      const utils = renderHeatmap([]);

      fireEvent.press(utils.getByTestId('heatmap-view-year'));
      // Year stacks the cards in a new layout, so they measure again.
      fireEvent(utils.getByTestId('heatmap-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 300 } } });

      expect(utils.UNSAFE_queryAllByType(Circle)).toHaveLength(0);
      const rects = within(utils.getByTestId('heatmap-canvas')).UNSAFE_getAllByType(Rect);
      expect(rects.length).toBeGreaterThan(300);
      expect(new Set(rects.map((r) => r.props.rx))).toEqual(new Set([2]));
    });
  });

  describe('sleep', () => {
    it('opens on the Steps page and switches pages with the page dots', () => {
      const { getByTestId } = renderHeatmap([]);

      expect(getByTestId('activity-title')).toHaveTextContent('Steps');
      expect(getByTestId('activity-page-steps').props.accessibilityState).toEqual({ selected: true });

      fireEvent.press(getByTestId('activity-page-sleep'));
      expect(getByTestId('activity-title')).toHaveTextContent('Sleep');
      expect(getByTestId('activity-page-sleep').props.accessibilityState).toEqual({ selected: true });

      fireEvent.press(getByTestId('activity-page-steps'));
      expect(getByTestId('activity-title')).toHaveTextContent('Steps');
    });

    it('follows a swipe that settles on the Sleep page', () => {
      const { getByTestId, UNSAFE_getAllByType } = renderHeatmap([]);
      fireEvent(getByTestId('activity-pager'), 'layout', { nativeEvent: { layout: { width: 350, height: 600 } } });
      const { ScrollView } = require('react-native');
      const pager = UNSAFE_getAllByType(ScrollView).find((s: { props: { snapToOffsets?: number[] } }) => s.props.snapToOffsets);

      // 350 wide: pages are 326, so Sleep starts at 350 - 2 * 24 + 10 = 312.
      expect(pager.props.snapToOffsets).toEqual([0, 312]);
      fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 312, y: 0 } } });

      expect(getByTestId('activity-title')).toHaveTextContent('Sleep');
    });

    it('keeps both pages on the same month', () => {
      const { getByTestId } = renderHeatmap([]);

      fireEvent.press(getByTestId('sleep-heatmap-prev-month'));

      expect(getByTestId('sleep-heatmap-title')).toHaveTextContent('August 2026');
      expect(getByTestId('heatmap-title')).toHaveTextContent('August 2026');
    });

    it('shows sleep stats for the visible month', () => {
      const { getByTestId } = renderHeatmap(
        [],
        '2025-01-01',
        sleepOf([
          nightOf('2026-08-31', 600), // outside September
          nightOf('2026-09-19', 420, { bedtime: '23:30' }),
          nightOf('2026-09-20', 490, { bedtime: '00:30' }),
          nightOf('2026-09-21', 500, { bedtime: '23:00' }),
          nightOf('2026-09-22', 480, { bedtime: '23:40' }),
        ]),
      );

      expect(getByTestId('sleep-stat-average')).toHaveTextContent('7h 53m');
      expect(getByTestId('sleep-stat-goal')).toHaveTextContent('3');
      expect(getByTestId('sleep-stat-streak')).toHaveTextContent('3 nights');
      // 23:30, 00:30, 23:00 and 23:40 average to 23:40, across midnight.
      expect(getByTestId('sleep-stat-bedtime')).toHaveTextContent('11:40 pm');
      expect(getByTestId('sleep-stat-longest')).toHaveTextContent('8h 20m · Sep 21');
    });

    it('opens the night sheet with time asleep, goal, bedtime, wake time, time in bed and score', () => {
      const { getByTestId } = renderHeatmap(
        [['2026-09-22', 12480]],
        '2025-01-01',
        sleepOf([
          nightOf('2026-09-21', 420),
          nightOf('2026-09-22', 467, { minutesInBed: 486, bedtime: '23:52', wakeTime: '07:58', sleepScore: 71 }),
        ]),
      );

      fireEvent.press(getByTestId('sleep-heatmap-grid'), { nativeEvent: SEP_22 });

      expect(getByTestId('night-detail-title')).toHaveTextContent('Night ending Tue, Sep 22, 2026');
      expect(getByTestId('night-detail-asleep')).toHaveTextContent('7h 47m');
      expect(getByTestId('night-detail-goal')).toHaveTextContent('97% of your 8h goal');
      expect(getByTestId('night-detail-bedtime')).toHaveTextContent('11:52 pm');
      expect(getByTestId('night-detail-wake')).toHaveTextContent('7:58 am');
      expect(getByTestId('night-detail-in-bed')).toHaveTextContent('8h 06m in bed · 96% of it asleep');
      expect(getByTestId('night-detail-score')).toHaveTextContent(/71/);
      expect(getByTestId('night-detail-steps-link')).toHaveTextContent(/12,480/);
      expect(getByTestId('night-detail-comparison')).toHaveTextContent('24m more than your average for this range.');
    });

    it('says so when a tapped night has no record, and hides what it does not know', () => {
      const { getByTestId, queryByTestId } = renderHeatmap([], '2025-01-01', sleepOf([]));

      fireEvent.press(getByTestId('sleep-heatmap-grid'), { nativeEvent: SEP_22 });

      expect(getByTestId('night-detail-empty')).toHaveTextContent('No sleep was recorded for this night.');
      expect(queryByTestId('night-detail-score')).toBeNull();
      expect(queryByTestId('night-detail-window')).toBeNull();
      expect(getByTestId('night-detail-steps-link')).toHaveTextContent(/No data/);
    });

    it('jumps between the two sheets for the same day, and the page follows', () => {
      const { getByTestId, queryByTestId } = renderHeatmap([['2026-09-22', 12000]], '2025-01-01', sleepOf([nightOf('2026-09-22', 467)]));

      fireEvent.press(getByTestId('heatmap-grid'), { nativeEvent: SEP_22 });
      expect(getByTestId('day-detail-sleep-link')).toHaveTextContent(/7h 47m/);

      fireEvent.press(getByTestId('day-detail-sleep-link'));
      expect(queryByTestId('day-detail')).toBeNull();
      expect(getByTestId('night-detail-asleep')).toHaveTextContent('7h 47m');
      expect(getByTestId('activity-title')).toHaveTextContent('Sleep');

      fireEvent.press(getByTestId('night-detail-steps-link'));
      expect(getByTestId('day-detail-steps')).toHaveTextContent('12,000 steps');
      expect(getByTestId('activity-title')).toHaveTextContent('Steps');
    });

    it('stacks steps above sleep in the year view, without page dots', () => {
      const { getByTestId, queryByTestId } = renderHeatmap([['2026-09-22', 9000]], '2025-01-01', sleepOf([nightOf('2026-09-22', 450)]));

      fireEvent.press(getByTestId('heatmap-view-year'));

      expect(getByTestId('activity-title')).toHaveTextContent('Steps & sleep');
      expect(queryByTestId('activity-page-sleep')).toBeNull();
      expect(queryByTestId('activity-pager')).toBeNull();
      expect(getByTestId('heatmap-metric')).toHaveTextContent(/Steps/);
      expect(getByTestId('sleep-heatmap-metric')).toHaveTextContent(/Sleep/);
      expect(getByTestId('sleep-heatmap-metric')).toHaveTextContent(/7h 30m avg \/ night/);
    });

    it('colours sleep on its own goal-relative levels', () => {
      const { getByTestId } = renderHeatmap([], '2025-01-01', sleepOf([nightOf('2026-09-21', 300), nightOf('2026-09-22', 480)]));

      const fills = within(getByTestId('sleep-heatmap-canvas'))
        .UNSAFE_getAllByType(Rect)
        .slice(20)
        .map((r) => r.props.fill);
      // Under 6h of an 8h goal is the lightest sleep level; at goal is the metric purple.
      expect([COLORS.light.sleepHeat1, COLORS.dark.sleepHeat1]).toContain(fills[0]);
      expect(fills[1]).toBe('rgb(147, 51, 234)');
    });

    it('is honest about sleep history that has not synced yet', () => {
      const { getByTestId } = renderHeatmap([], '2025-01-01', sleepOf([], null));

      expect(getByTestId('sleep-heatmap-history-note')).toHaveTextContent('Your sleep history is still syncing.');
    });

    it('offers a retry on the Sleep page when sleep failed to load, while steps still work', () => {
      const retry = jest.fn();
      const { getByTestId } = renderHeatmap([['2026-09-22', 5000]], '2025-01-01', { phase: 'error' }, retry);

      expect(getByTestId('stat-total')).toHaveTextContent('5,000');
      fireEvent.press(getByTestId('sleep-retry'));
      expect(retry).toHaveBeenCalled();
    });

    it('hides the sleep link on a steps day while sleep is unavailable', () => {
      const { getByTestId, queryByTestId } = renderHeatmap([['2026-09-22', 5000]], '2025-01-01', { phase: 'loading' });

      fireEvent.press(getByTestId('heatmap-grid'), { nativeEvent: SEP_22 });

      expect(getByTestId('day-detail-steps')).toBeTruthy();
      expect(queryByTestId('day-detail-sleep-link')).toBeNull();
    });
  });
});
