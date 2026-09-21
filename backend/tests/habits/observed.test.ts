import { buildObservedDays } from '../../src/habits/observed';

const alcohol = { type: 'ALCOHOL', exposureThreshold: 2 };
const log = (habitDay: string, value: number, habitType = 'ALCOHOL') => ({ habitType, value, habitDay });

describe('buildObservedDays', () => {
  it('excludes a day with no log and no check-in (missing, not unexposed)', () => {
    const out = buildObservedDays([log('2026-09-01', 3)], [], [alcohol]).get('ALCOHOL')!;
    expect(out.map((d) => d.day)).toEqual(['2026-09-01']);
  });

  it('counts a logged 0 as observed and unexposed', () => {
    const out = buildObservedDays([log('2026-09-01', 0)], [], [alcohol]).get('ALCOHOL')!;
    expect(out).toEqual([{ day: '2026-09-01', exposed: false }]);
  });

  it('counts a check-in with no log as observed and unexposed', () => {
    const out = buildObservedDays([], ['2026-09-02'], [alcohol]).get('ALCOHOL')!;
    expect(out).toEqual([{ day: '2026-09-02', exposed: false }]);
  });

  it('applies the threshold to the day TOTAL, not to each log', () => {
    const logs = [log('2026-09-03', 1), log('2026-09-03', 1), log('2026-09-04', 1)];
    const out = buildObservedDays(logs, [], [alcohol]).get('ALCOHOL')!;
    expect(out).toEqual([
      { day: '2026-09-03', exposed: true },
      { day: '2026-09-04', exposed: false },
    ]);
  });

  it('exposes exactly at the threshold and not below', () => {
    const out = buildObservedDays([log('2026-09-03', 2), log('2026-09-04', 1.9)], [], [alcohol]).get('ALCOHOL')!;
    expect(out.map((d) => d.exposed)).toEqual([true, false]);
  });

  it('a check-in covers every type; a log covers only its own type', () => {
    const types = [alcohol, { type: 'CAFFEINE', exposureThreshold: 3 }];
    const out = buildObservedDays([log('2026-09-05', 4, 'CAFFEINE')], ['2026-09-06'], types);
    expect(out.get('ALCOHOL')).toEqual([{ day: '2026-09-06', exposed: false }]);
    expect(out.get('CAFFEINE')).toEqual([
      { day: '2026-09-05', exposed: true },
      { day: '2026-09-06', exposed: false },
    ]);
  });

  it('returns days in ascending order regardless of input order', () => {
    const out = buildObservedDays([log('2026-09-09', 0), log('2026-09-01', 0)], ['2026-09-05'], [alcohol]).get('ALCOHOL')!;
    expect(out.map((d) => d.day)).toEqual(['2026-09-01', '2026-09-05', '2026-09-09']);
  });

  it('a check-in day with a logged exposure stays exposed', () => {
    const out = buildObservedDays([log('2026-09-07', 3)], ['2026-09-07'], [alcohol]).get('ALCOHOL')!;
    expect(out).toEqual([{ day: '2026-09-07', exposed: true }]);
  });
});
