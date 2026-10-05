import { yearPixels } from '../../src/lib/yearPixels';

const cells = (y: ReturnType<typeof yearPixels>) => y.rows.flatMap((r) => r.cells);

it('draws one cell per night of the calendar year, Feb 29 included in a leap year (Review Focus 4)', () => {
  const leap = yearPixels(2028, [], 480, '2028-12-31');
  expect(cells(leap)).toHaveLength(366);
  expect(leap.rows[1]!.cells.map((c) => c.date).pop()).toBe('2028-02-29');
  expect(cells(yearPixels(2026, [], 480, '2026-12-31'))).toHaveLength(365);
});

it('colours by the current goal and counts only past nights on goal', () => {
  const y = yearPixels(
    2026,
    [
      { date: '2026-01-02', minutesAsleep: 500 },
      { date: '2026-03-03', minutesAsleep: 480 },
      { date: '2026-04-04', minutesAsleep: 400 },
      { date: '2026-11-01', minutesAsleep: 520 }, // after today: never counted
      { date: '2026-05-05', minutesAsleep: 0 },
    ],
    480,
    '2026-10-05',
  );
  const level = (d: string) => cells(y).find((c) => c.date === d)!.level;
  expect([level('2026-01-02'), level('2026-03-03'), level('2026-04-04'), level('2026-05-05'), level('2026-11-01'), level('2026-10-05')]).toEqual([
    'goal', 'goal', 'short', 'none', 'future', 'none',
  ]);
  expect(y.onGoal).toBe(2);
});
