import { daysFromQuestion, planPrefetch } from '../../src/coach/prefetch';

describe('planPrefetch', () => {
  it('pre-fetches a metric history for a one-metric question about a span of time', () => {
    expect(planPrefetch('How has my HRV trended over the last week?')).toEqual([
      { name: 'getMetricHistory', args: { metric: 'HRV', days: 7 } },
    ]);
    expect(planPrefetch('How many days did I hit my step goal this month?')).toEqual([
      { name: 'getMetricHistory', args: { metric: 'STEPS', days: 30 } },
    ]);
    expect(planPrefetch('What was my best step day in the last two weeks?')).toEqual([
      { name: 'getMetricHistory', args: { metric: 'STEPS', days: 14 } },
    ]);
    expect(planPrefetch('average resting heart rate over the past 45 days')).toEqual([
      { name: 'getMetricHistory', args: { metric: 'RESTING_HR', days: 45 } },
    ]);
  });

  it('reads "heart rate variability" as HRV, not also resting heart rate', () => {
    expect(planPrefetch('How has my heart rate variability trended this week?')).toEqual([
      { name: 'getMetricHistory', args: { metric: 'HRV', days: 7 } },
    ]);
  });

  it('does not pre-fetch history for a single-day question or for several metrics at once', () => {
    expect(planPrefetch("What is today's step count?")).toEqual([]);
    expect(planPrefetch('How did I sleep last night?')).toEqual([]);
    // Two history calls would make each other's references ambiguous; the model calls the tool itself.
    expect(planPrefetch('Compare my steps and sleep this week')).toEqual([]);
  });

  it('pre-fetches habit logs for questions about what was logged', () => {
    expect(planPrefetch('How much did I drink this week?')).toEqual([{ name: 'getHabitLogs', args: { days: 7 } }]);
    expect(planPrefetch('How many coffees this month?')).toEqual([{ name: 'getHabitLogs', args: { days: 30 } }]);
    expect(planPrefetch('Did I work out yesterday? Any workouts logged?')).toEqual([{ name: 'getHabitLogs', args: { days: 7 } }]);
  });
});

describe('daysFromQuestion', () => {
  it('maps the span a question names to a day count, capped', () => {
    expect(daysFromQuestion('last 10 days', 7, 90)).toBe(10);
    expect(daysFromQuestion('past 500 days', 7, 90)).toBe(90);
    expect(daysFromQuestion('this year', 7, 90)).toBe(90);
    expect(daysFromQuestion('this month', 7, 30)).toBe(30);
    expect(daysFromQuestion('lately', 7, 90)).toBe(7);
  });
});
