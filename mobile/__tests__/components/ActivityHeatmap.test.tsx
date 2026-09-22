import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { ActivityHeatmap } from '../../src/components/activity-heatmap';

const TODAY = '2026-09-22';

function renderHeatmap(steps: [string, number][], earliestDate: string | null = '2025-01-01') {
  const utils = render(<ActivityHeatmap steps={new Map(steps)} earliestDate={earliestDate} today={TODAY} />);
  // The grid is sized from the measured width; 350 gives 50 dp month bins.
  fireEvent(utils.getByTestId('heatmap-canvas'), 'layout', { nativeEvent: { layout: { width: 350, height: 300 } } });
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
});
