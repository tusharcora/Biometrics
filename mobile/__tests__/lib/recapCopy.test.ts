import { cardStats, compareRows, goalLabel, milestoneLines, monthName, readyCardTitle, recapTitle, shortDate, weekdayName } from '../../src/lib/recapCopy';

it('names periods and days', () => {
  expect(monthName('2026-09-01')).toBe('September');
  expect(shortDate('2026-09-28')).toBe('Sep 28');
  expect(weekdayName('2026-09-29')).toBe('Tuesday');
  expect(recapTitle({ kind: 'MONTH', periodStart: '2026-09-01' })).toBe('September 2026');
  expect(recapTitle({ kind: 'WEEK', periodStart: '2026-09-28' })).toBe('Week of Sep 28');
  expect(readyCardTitle({ kind: 'MONTH', periodStart: '2026-09-01' })).toBe('Your September recap is ready');
  expect(readyCardTitle({ kind: 'WEEK', periodStart: '2026-09-28' })).toBe('Your week is ready');
  expect(goalLabel(480)).toBe('8h');
  expect(goalLabel(450)).toBe('7h 30m');
});

it('lists up to four card stats in a fixed order, skipping missing ones', () => {
  expect(cardStats({ nightsWithData: 25, avgSleepMinutes: 425, longestOnGoalStreak: 6, bestRecovery: { date: '2026-09-09', score: 88 }, steps: { total: 210000, dailyAverage: 7000 } })).toEqual([
    { key: 'avgSleep', label: 'Avg sleep', value: '7h 5m' },
    { key: 'streak', label: 'Longest streak', value: '6 nights' },
    { key: 'bestRecovery', label: 'Best recovery', value: '88' },
    { key: 'steps', label: 'Steps a day', value: '7,000' },
  ]);
  expect(cardStats({ nightsWithData: 9, longestOnGoalStreak: 1 }).map((s) => s.value)).toEqual(['1 night']);
});

it('words only the comparisons present, with a direction arrow each', () => {
  expect(compareRows({ avgSleepDelta: 18, bedtimeSpreadDelta: -9, avgRecoveryDelta: -4 })).toEqual([
    { key: 'avgSleep', arrow: '↑', text: '18m more sleep a night' },
    { key: 'spread', arrow: '↓', text: 'Bedtimes 9m steadier' },
    { key: 'recovery', arrow: '↓', text: 'Recovery 4 points lower' },
  ]);
  expect(compareRows({ avgSleepDelta: 0 })).toEqual([{ key: 'avgSleep', arrow: '=', text: 'Same sleep a night' }]);
  expect(compareRows(undefined)).toEqual([]);
});

it('words the milestones achieved', () => {
  expect(milestoneLines({ streak: { nights: 6 }, bestRecoveryWeek: { weekStart: '2026-09-07', avgRecovery: 80 }, everyDayLogged: { days: 30 }, steadiestMonth: { spreadMinutes: 10 } })).toEqual([
    { key: 'streak', text: '6 nights on goal in a row' },
    { key: 'bestRecoveryWeek', text: "Best recovery week, beating last month's: 80 (week of Sep 7)" },
    { key: 'everyDayLogged', text: 'Every night of the month logged' },
    { key: 'steadiestMonth', text: 'Your steadiest bedtimes yet (10m spread)' },
  ]);
});
