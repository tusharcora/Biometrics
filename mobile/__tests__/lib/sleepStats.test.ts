import type { SleepNight } from '../../src/api/sleep';
import { sleepHeatLevel } from '../../src/lib/heatmap';
import { compareSleepToAverage, formatClock, formatDuration, sleepRangeStats } from '../../src/lib/sleepStats';

function nights(entries: [string, number, string?][]): Map<string, SleepNight> {
  return new Map(
    entries.map(([date, minutesAsleep, bedtime]) => [
      date,
      { date, minutesAsleep, minutesInBed: null, bedtime: bedtime ?? null, wakeTime: null, sleepScore: null },
    ]),
  );
}

describe('sleepHeatLevel', () => {
  it.each([
    [null, null],
    [0, 0],
    [300, 1], // 5h: under 75% of 8h
    [359, 1],
    [360, 2], // 6h
    [419, 2],
    [420, 3], // 7h
    [479, 3],
    [480, 4], // at goal
    [600, 4],
  ])('%s minutes -> level %s', (minutes, level) => {
    expect(sleepHeatLevel(minutes, 480)).toBe(level);
  });
});

describe('sleepRangeStats', () => {
  const TODAY = '2026-09-22';

  it('averages only nights with a record, and counts nights at goal', () => {
    const stats = sleepRangeStats(nights([['2026-09-20', 400], ['2026-09-22', 500]]), '2026-09-01', '2026-09-30', TODAY, 480);

    expect(stats.nights).toBe(2);
    expect(stats.averageMinutes).toBe(450);
    expect(stats.goalNights).toBe(1);
    expect(stats.longest).toEqual({ date: '2026-09-22', minutes: 500 });
  });

  it('counts tonight in the streak once it is recorded, and up to yesterday until then', () => {
    const recorded = nights([['2026-09-20', 490], ['2026-09-21', 480], ['2026-09-22', 485]]);
    expect(sleepRangeStats(recorded, '2026-09-01', '2026-09-30', TODAY, 480).streak).toBe(3);

    const notYet = nights([['2026-09-20', 490], ['2026-09-21', 480]]);
    expect(sleepRangeStats(notYet, '2026-09-01', '2026-09-30', TODAY, 480).streak).toBe(2);

    const shortLastNight = nights([['2026-09-21', 480], ['2026-09-22', 300]]);
    expect(sleepRangeStats(shortLastNight, '2026-09-01', '2026-09-30', TODAY, 480).streak).toBe(0);
  });

  it('averages bedtimes across midnight, and skips nights without one', () => {
    const stats = sleepRangeStats(
      nights([['2026-09-20', 450, '23:30'], ['2026-09-21', 450, '00:30'], ['2026-09-22', 450]]),
      '2026-09-01',
      '2026-09-30',
      TODAY,
      480,
    );

    expect(stats.averageBedtime).toBe('00:00');
  });

  it('is empty, not zero, for a range with no nights', () => {
    expect(sleepRangeStats(new Map(), '2026-09-01', '2026-09-30', TODAY, 480)).toEqual({
      nights: 0,
      averageMinutes: null,
      goalNights: 0,
      streak: 0,
      averageBedtime: null,
      longest: null,
    });
  });
});

describe('formatting', () => {
  it('formats durations and clock times', () => {
    expect(formatDuration(467)).toBe('7h 47m');
    expect(formatDuration(480)).toBe('8h 00m');
    expect(formatClock('23:52')).toBe('11:52 pm');
    expect(formatClock('00:05')).toBe('12:05 am');
    expect(formatClock('12:00')).toBe('12:00 pm');
  });

  it('compares a night to the average', () => {
    expect(compareSleepToAverage(467, 443)).toBe('24m more than your average for this range.');
    expect(compareSleepToAverage(380, 480)).toBe('1h 40m less than your average for this range.');
    expect(compareSleepToAverage(452, 450)).toBe('In line with your average for this range.');
    expect(compareSleepToAverage(452, null)).toBeNull();
  });
});
