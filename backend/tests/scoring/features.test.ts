import {
  sleepDebtRolling,
  buildSleepDebtSeries,
  baselineDeviationPct,
  acuteChronicLoadRatio,
} from '../../src/scoring/features';
import { v1Config } from '../../src/scoring/configs/v1';
import { series } from './helpers';

const cfg = v1Config;

describe('Stage 2: sleepDebtRolling14d', () => {
  it('sums max(0, goal - minutesAsleep) over the 14 days ending on the date, inclusive', () => {
    const sleep = series('2026-08-01', Array(14).fill(420)); // 60 short each night
    expect(sleepDebtRolling(sleep, '2026-08-14', 480, cfg)).toBe(14 * 60);
  });

  it("floors each night at 0: a long night does not pay back another night's deficit", () => {
    const sleep = series('2026-08-01', [300, 600, ...Array(12).fill(480)]);
    expect(sleepDebtRolling(sleep, '2026-08-14', 480, cfg)).toBe(180);
  });

  it('only looks at the trailing 14 days', () => {
    const sleep = series('2026-08-01', [0, ...Array(14).fill(480)]); // the 0 is outside the window ending 08-15
    expect(sleepDebtRolling(sleep, '2026-08-15', 480, cfg)).toBe(0);
  });

  it('counts a missing night as no information (0), not as a full-goal deficit', () => {
    const sleep = series('2026-08-01', [400]);
    expect(sleepDebtRolling(sleep, '2026-08-14', 480, cfg)).toBe(80);
  });

  it('uses the supplied goal, not a hardcoded 480', () => {
    const sleep = series('2026-08-14', [420]);
    expect(sleepDebtRolling(sleep, '2026-08-14', 420, cfg)).toBe(0);
    expect(sleepDebtRolling(sleep, '2026-08-14', 540, cfg)).toBe(120);
  });
});

describe('Stage 2: buildSleepDebtSeries', () => {
  it("only emits days whose full 14-day window lies inside the user's history", () => {
    // A window that starts before the user's first night would be understated by
    // construction and bias the baseline; those days are not part of the series.
    const sleep = series('2026-08-01', Array(20).fill(420));
    const debt = buildSleepDebtSeries(sleep, '2026-08-20', 480, cfg);
    expect(debt[0]).toEqual({ date: '2026-08-14', value: 14 * 60 });
    expect(debt).toHaveLength(7);
  });

  it('is empty when there is less than a full window of history', () => {
    expect(buildSleepDebtSeries(series('2026-08-01', Array(10).fill(420)), '2026-08-10', 480, cfg)).toEqual([]);
  });
});

describe('Stage 2: baselineDeviationPct', () => {
  it('is (value - ewma) / ewma * 100', () => {
    expect(baselineDeviationPct(44, 40)).toBeCloseTo(10, 10);
    expect(baselineDeviationPct(36, 40)).toBeCloseTo(-10, 10);
  });
});

describe('Stage 2: acuteChronicLoadRatio', () => {
  it('is the 7-day mean over the 28-day mean of steps', () => {
    const steps = series('2026-07-01', [...Array(21).fill(6000), ...Array(7).fill(12000)]);
    // acute mean 12000; chronic mean (21*6000 + 7*12000)/28 = 7500
    expect(acuteChronicLoadRatio(steps, '2026-07-28', cfg)).toBeCloseTo(12000 / 7500, 10);
  });

  it('is 1 for constant load', () => {
    expect(acuteChronicLoadRatio(series('2026-07-01', Array(28).fill(8000)), '2026-07-28', cfg)).toBeCloseTo(1, 10);
  });

  it('is null without enough chronic history', () => {
    expect(acuteChronicLoadRatio(series('2026-07-20', Array(9).fill(8000)), '2026-07-28', cfg)).toBeNull();
  });
});
