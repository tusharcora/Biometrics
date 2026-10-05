import { dateRange } from '../../src/scoring/dates';
import { computeRecapStats, isEligible } from '../../src/recap/stats';
import type { DayData, RecapData } from '../../src/recap/types';

const W = '2026-09-28'; // Mon 28 Sep – Sun 4 Oct

function week(): RecapData {
  const d: RecapData = new Map<string, DayData>([
    ['2026-09-28', { sleepMinutes: 480, sleepScore: 80, recovery: 70.4, steps: 8000, bedtime: 600 }],
    ['2026-09-29', { sleepMinutes: 500, sleepScore: 85, recovery: 88.6, steps: 12000, bedtime: 630 }],
    ['2026-09-30', { steps: 6000 }], // no sleep: breaks the streak, still a steps day
    ['2026-10-01', { sleepMinutes: 490, sleepScore: 85, recovery: 88.2, bedtime: 660 }],
    ['2026-10-02', { sleepMinutes: 420, sleepScore: 60, recovery: 50, bedtime: 720 }],
    ['2026-10-03', { sleepMinutes: 485, sleepScore: 70, recovery: 66, bedtime: 615 }],
    ['2026-10-04', { sleepMinutes: 495, sleepScore: 75, recovery: 71, bedtime: 645 }],
  ]);
  return d;
}

function withPrevious(d: RecapData, nights: number): RecapData {
  dateRange('2026-09-21', '2026-09-27').slice(0, nights).forEach((date) => d.set(date, { sleepMinutes: 450, recovery: 60, bedtime: 650 }));
  return d;
}

describe('computeRecapStats: WEEK numbers', () => {
  it('computes every section-1 number from raw data', () => {
    const s = computeRecapStats('WEEK', W, withPrevious(week(), 4), 480);
    expect(s).toMatchObject({
      nightsWithData: 6,
      avgSleepMinutes: 478, // 2870 / 6
      nightsOnGoal: 5,
      longestOnGoalStreak: 2, // Mon–Tue; Wednesday has no night, so Thursday starts again
      bestNight: { date: '2026-09-29', minutesAsleep: 500 }, // score tie 85 → the longer night
      bestRecovery: { date: '2026-09-29', score: 89 },
      avgRecovery: 72,
      steps: { total: 26000, dailyAverage: 8667 },
      bedtimeSpreadMinutes: 39,
      earlierBedtimes: { nights: 4, of: 6 },
      comparison: { avgSleepDelta: 28, bedtimeSpreadDelta: 39, avgRecoveryDelta: 12 },
    });
    expect(s.weekStrip).toHaveLength(7);
    expect(s.weekStrip![2]).toEqual({ date: '2026-09-30', minutesAsleep: null, onGoal: null, recovery: null });
    expect(s.weekStrip![4]).toEqual({ date: '2026-10-02', minutesAsleep: 420, onGoal: false, recovery: 50 });
    expect(s.milestones).toBeUndefined();
  });

  it('has no comparison and no earlier bedtimes for a first period, or after a thin one', () => {
    for (const d of [week(), withPrevious(week(), 2)]) {
      const s = computeRecapStats('WEEK', W, d, 480);
      expect(s.comparison).toBeUndefined();
      expect(s.earlierBedtimes).toBeUndefined();
    }
  });

  it('counts on-goal nights against the goal it is given (the snapshot)', () => {
    expect(computeRecapStats('WEEK', W, week(), 490).nightsOnGoal).toBe(3);
  });

  it('omits numbers whose data is missing, never zero-filling them', () => {
    const d: RecapData = new Map([
      ['2026-09-28', { sleepMinutes: 400 }],
      ['2026-09-29', { sleepMinutes: 500 }],
      ['2026-09-30', { sleepMinutes: 450 }],
    ]);
    const s = computeRecapStats('WEEK', W, d, 480);
    expect(s).toMatchObject({ nightsWithData: 3, nightsOnGoal: 1, bestNight: { date: '2026-09-29', minutesAsleep: 500 } });
    for (const key of ['bestRecovery', 'avgRecovery', 'steps', 'bedtimeSpreadMinutes', 'earlierBedtimes', 'comparison'] as const) {
      expect(s).not.toHaveProperty(key);
    }
  });

  it('needs 4 bedtimes for a spread and 3 / 7 nights for eligibility', () => {
    const thin: RecapData = new Map([['2026-09-28', { sleepMinutes: 480, bedtime: 600 }], ['2026-09-29', { sleepMinutes: 480, bedtime: 610 }]]);
    const s = computeRecapStats('WEEK', W, thin, 480);
    expect(s.bedtimeSpreadMinutes).toBeUndefined();
    expect(isEligible('WEEK', s)).toBe(false);
    expect(isEligible('WEEK', { nightsWithData: 3 })).toBe(true);
    expect(isEligible('MONTH', { nightsWithData: 6 })).toBe(false);
    expect(isEligible('MONTH', { nightsWithData: 7 })).toBe(true);
  });
});

describe('computeRecapStats: MONTH milestones', () => {
  const fill = (d: RecapData, from: string, to: string, f: (date: string, i: number) => DayData) =>
    dateRange(from, to).forEach((date, i) => d.set(date, { ...d.get(date), ...f(date, i) }));

  it('awards the streak, every-day-logged and best-recovery-week milestones by their rules', () => {
    const d: RecapData = new Map();
    fill(d, '2026-08-01', '2026-08-31', () => ({ sleepMinutes: 470, recovery: 75 }));
    fill(d, '2026-09-01', '2026-09-30', (date) => ({ sleepMinutes: 490, recovery: date >= '2026-09-07' && date <= '2026-09-13' ? 80 : 70 }));
    const m = computeRecapStats('MONTH', '2026-09-01', d, 480).milestones!;
    expect(m.streak).toEqual({ nights: 30 });
    expect(m.everyDayLogged).toEqual({ days: 30 });
    expect(m.bestRecoveryWeek).toEqual({ weekStart: '2026-09-07', avgRecovery: 80 }); // beats August's 75 by ≥ 1
  });

  it('withholds the best week when it does not beat last month by a point, and the streak under 5', () => {
    const d: RecapData = new Map();
    fill(d, '2026-08-01', '2026-08-31', () => ({ sleepMinutes: 470, recovery: 80 }));
    fill(d, '2026-09-01', '2026-09-30', (_date, i) => ({ sleepMinutes: i % 5 === 4 ? 400 : 490, recovery: 80 }));
    const m = computeRecapStats('MONTH', '2026-09-01', d, 480).milestones!;
    expect(m.bestRecoveryWeek).toBeUndefined();
    expect(m.streak).toBeUndefined(); // runs of 4
  });

  it('calls a month the steadiest only with 3 earlier eligible months, all less steady', () => {
    const d: RecapData = new Map();
    for (const [from, to] of [['2026-06-01', '2026-06-30'], ['2026-07-01', '2026-07-31'], ['2026-08-01', '2026-08-31']] as const) {
      fill(d, from, to, (_date, i) => ({ sleepMinutes: 470, bedtime: i % 2 ? 600 : 680 })); // spread 40
    }
    fill(d, '2026-09-01', '2026-09-30', (_date, i) => ({ sleepMinutes: 470, bedtime: i % 2 ? 630 : 650 })); // spread 10
    expect(computeRecapStats('MONTH', '2026-09-01', d, 480).milestones!.steadiestMonth).toEqual({ spreadMinutes: 10 });
    for (const date of dateRange('2026-06-01', '2026-06-30')) d.delete(date);
    expect(computeRecapStats('MONTH', '2026-09-01', d, 480).milestones!.steadiestMonth).toBeUndefined();
  });
});
