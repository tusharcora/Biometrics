import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityHeader } from '../../src/components/activity/ActivityHeader';
import { ThisWeek } from '../../src/components/activity/ThisWeek';
import { YearSoFar } from '../../src/components/activity/YearSoFar';
import { weekRows } from '../../src/lib/activityWeek';
import { COLORS } from '../../src/theme';

const TODAY = '2026-10-10';
const BANDS = { excellent: 80, good: 60, fair: 40 };

describe('ThisWeek', () => {
  const rows = weekRows(
    TODAY,
    new Map([[TODAY, 8412], ['2026-10-06', 4215]]),
    new Map([[TODAY, 432], ['2026-10-06', 310]]),
    new Map([[TODAY, 68], ['2026-10-06', 38]]),
    BANDS,
  );

  it('heads the columns and lists seven days, newest first, with today highlighted', () => {
    render(<ThisWeek rows={rows} onOpenDay={jest.fn()} onOpenNight={jest.fn()} />);

    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('Tap a day · moon opens Sleep')).toBeTruthy();
    for (const label of ['Day', 'Recovery', 'Sleep · steps']) expect(screen.getByText(label, { includeHiddenElements: true })).toBeTruthy();
    const ids = screen.getAllByTestId(/^week-row-/).map((r) => r.props.testID);
    expect(ids[0]).toBe(`week-row-${TODAY}`);
    expect(ids).toHaveLength(7);
    expect(String(screen.getByTestId(`week-row-${TODAY}`).props.className)).toContain('bg-muted');
    expect(String(screen.getByTestId('week-row-2026-10-09').props.className)).not.toContain('bg-muted');
  });

  it('draws a low recovery in the low colour, and a day with no data as dashes', () => {
    render(<ThisWeek rows={rows} onOpenDay={jest.fn()} onOpenNight={jest.fn()} />);

    const low = screen.getByTestId('week-recovery-2026-10-06');
    expect([COLORS.light.scorePoor, COLORS.dark.scorePoor]).toContain(StyleSheet.flatten(low.props.style).color);
    expect(StyleSheet.flatten(screen.getByTestId(`week-recovery-${TODAY}`).props.style)?.color).not.toBe(COLORS.dark.scorePoor);
    expect(screen.getByTestId('week-recovery-2026-10-09')).toHaveTextContent('—');
    expect(screen.getByTestId('week-sleep-2026-10-09')).toHaveTextContent('—');
    expect(screen.getByTestId('week-steps-2026-10-09')).toHaveTextContent('—');
  });

  it('scales sleep to 9 hours and steps to 15,000', () => {
    render(<ThisWeek rows={rows} onOpenDay={jest.fn()} onOpenNight={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId(`week-sleep-${TODAY}-fill`).props.style).width).toBe('80%');
    expect(StyleSheet.flatten(screen.getByTestId(`week-steps-${TODAY}-fill`).props.style).width).toBe('56%');
  });

  it('reads a row out in full, and opens the day or the night', () => {
    const onOpenDay = jest.fn();
    const onOpenNight = jest.fn();
    render(<ThisWeek rows={rows} onOpenDay={onOpenDay} onOpenNight={onOpenNight} />);

    expect(screen.getByTestId(`week-row-${TODAY}`).props.accessibilityLabel).toBe('Saturday 10 October, recovery 68, mostly clear, slept 7h 12m, 8,412 steps');
    fireEvent.press(screen.getByTestId(`week-row-${TODAY}`));
    expect(onOpenDay).toHaveBeenCalledWith(TODAY);
    expect(screen.getByTestId(`week-moon-${TODAY}`).props.accessibilityLabel).toBe("Open Saturday's night in Sleep");
    fireEvent.press(screen.getByTestId(`week-moon-${TODAY}`));
    expect(onOpenNight).toHaveBeenCalledWith(TODAY);
    expect(screen.queryByTestId('week-moon-2026-10-09')).toBeNull();
  });
});

describe('YearSoFar', () => {
  const steps = new Map([['2025-12-31', 99999], ['2026-01-05', 12000], ['2026-10-10', 6000]]);
  const minutes = new Map([['2026-01-05', 480], ['2026-10-10', 420]]);

  it("shows the year's step total, daily average and goal days", () => {
    render(<YearSoFar steps={steps} sleep={{ phase: 'ready', minutes }} today={TODAY} stepGoal={10000} sleepGoal={480} onRetrySleep={jest.fn()} />);

    expect(screen.getByText('2026 so far')).toBeTruthy();
    expect(screen.getByTestId('year-total')).toHaveTextContent('18,000');
    expect(screen.getByTestId('year-average')).toHaveTextContent('9,000');
    expect(screen.getByTestId('year-goal')).toHaveTextContent('1');
  });

  it('switches to sleep: hours slept, nightly average, nights at goal', () => {
    render(<YearSoFar steps={steps} sleep={{ phase: 'ready', minutes }} today={TODAY} stepGoal={10000} sleepGoal={480} onRetrySleep={jest.fn()} />);
    fireEvent.press(screen.getByTestId('year-tab-sleep'));

    expect(screen.getByTestId('year-total')).toHaveTextContent('15h');
    expect(screen.getByTestId('year-average')).toHaveTextContent('7h 30m');
    expect(screen.getByTestId('year-goal')).toHaveTextContent('1');
    expect(screen.getByText('Goal nights')).toBeTruthy();
  });

  it('offers a retry on the sleep side when sleep failed', () => {
    const retry = jest.fn();
    render(<YearSoFar steps={steps} sleep={{ phase: 'error' }} today={TODAY} stepGoal={10000} sleepGoal={480} onRetrySleep={retry} />);
    fireEvent.press(screen.getByTestId('year-tab-sleep'));
    fireEvent.press(screen.getByTestId('year-sleep-retry'));
    expect(retry).toHaveBeenCalled();
  });
});

describe('ActivityHeader', () => {
  it('shows KIP waving, the title and the week summary', () => {
    render(<ActivityHeader summary={{ steps: 64947, nights: 7 }} />);
    expect(screen.getByTestId('activity-kip', { includeHiddenElements: true })).toBeTruthy();
    // PageTitle sets it in the pixel face's capitals, and a screen reader hears it in its own case.
    expect(screen.getByTestId('activity-title')).toHaveTextContent('ACTIVITY');
    expect(screen.getByRole('header', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByTestId('activity-summary')).toHaveTextContent('Last 7 days · 64,947 steps · 7 nights');
  });

  it('leaves the summary out until the week is known', () => {
    render(<ActivityHeader summary={null} />);
    expect(screen.queryByTestId('activity-summary')).toBeNull();
  });
});
