import { scoreDay, PipelineInput } from '../../src/scoring/pipeline';
import { v1Config } from '../../src/scoring/configs/v1';
import { shiftDate } from '../../src/scoring/dates';
import type { DailyPoint } from '../../src/scoring/types';

const cfg = v1Config;
const START = '2026-06-01';

// Deterministic pseudo-noise: no Math.random, so failures reproduce.
function wave(days: number, base: number, amp: number, phase = 0): DailyPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    date: shiftDate(START, i),
    value: base + amp * Math.sin((i + phase) * 1.7),
  }));
}

function input(over: Partial<PipelineInput> = {}, days = 40): PipelineInput {
  return {
    date: shiftDate(START, days - 1),
    hrv: wave(days, 50, 4),
    rhr: wave(days, 55, 2, 1),
    sleep: wave(days, 450, 30, 2),
    steps: wave(days, 8000, 1500, 3),
    sleepGoalMinutes: 480,
    ...over,
  };
}

function replaceToday(points: DailyPoint[], date: string, value: number | null): DailyPoint[] {
  const rest = points.filter((p) => p.date !== date);
  return value === null ? rest : [...rest, { date, value }];
}

describe('scoreDay', () => {
  it('produces a HIGH-confidence score from a full history with every factor present', () => {
    const r = scoreDay(input(), cfg);
    expect(r.hasObservedInput).toBe(true);
    expect(r.score).not.toBeNull();
    expect(r.confidenceLevel).toBe('HIGH');
    expect(r.factors.every((f) => !f.excluded && !f.imputed)).toBe(true);
    expect(r.algorithmVersion).toBe('v1');
  });

  it('scores a day with depressed HRV and elevated RHR below a day with the opposite', () => {
    const base = input();
    const d = base.date;
    const bad = scoreDay({ ...base, hrv: replaceToday(base.hrv, d, 35), rhr: replaceToday(base.rhr, d, 62) }, cfg);
    const good = scoreDay({ ...base, hrv: replaceToday(base.hrv, d, 60), rhr: replaceToday(base.rhr, d, 52) }, cfg);
    expect(bad.score!).toBeLessThan(50);
    expect(good.score!).toBeGreaterThan(50);
  });

  it('excludes every factor and returns a null score while all baselines are cold-starting', () => {
    const r = scoreDay(input({}, 10), cfg);
    expect(r.score).toBeNull();
    expect(r.confidenceLevel).toBe('LOW');
    expect(r.factors.every((f) => f.excluded)).toBe(true);
    const hrv = r.baselines.find((b) => b.metric === 'HRV')!.baseline;
    expect(hrv).toEqual({ coldStart: true, daysOfHistory: 9 });
    expect(r.features.hrvZ).toBeNull();
  });

  it('renormalizes weights around a cold-starting HRV (0.35/0.55 and 0.20/0.55)', () => {
    const base = input();
    const hrvOnly10 = base.hrv.slice(-10);
    const r = scoreDay({ ...base, hrv: hrvOnly10 }, cfg);
    const byFactor = Object.fromEntries(r.factors.map((f) => [f.factor, f]));
    expect(byFactor.HRV!.excluded).toBe(true);
    expect(byFactor.RHR!.weight).toBeCloseTo(0.35 / 0.55, 12);
    expect(byFactor.SLEEP_DEBT!.weight).toBeCloseTo(0.2 / 0.55, 12);
    expect(r.confidenceLevel).toBe('MEDIUM');
  });

  it('holds sleep debt in cold-start until 14 debt-series days exist (a full window plus 14 days of it)', () => {
    // 27 nights: the first full 14-night window ends on night 14, giving 13 debt values before day 27.
    const r = scoreDay(input({}, 27), cfg);
    expect(r.factors.find((f) => f.factor === 'SLEEP_DEBT')!.excluded).toBe(true);
    const r28 = scoreDay(input({}, 28), cfg);
    expect(r28.factors.find((f) => f.factor === 'SLEEP_DEBT')!.excluded).toBe(false);
  });

  it("imputes a missing HRV day from its own EWMA (z = 0), flags it imputed and lowers confidence", () => {
    const base = input();
    const r = scoreDay({ ...base, hrv: replaceToday(base.hrv, base.date, null) }, cfg);
    const hrv = r.factors.find((f) => f.factor === 'HRV')!;
    expect(hrv.imputed).toBe(true);
    expect(hrv.z).toBeCloseTo(0, 12);
    expect(r.features.hrvZImputed).toBe(true);
    expect(r.confidenceLevel).toBe('MEDIUM');
  });

  it('flags an outlier HRV reading, scores that day as a gap, and leaves the input record untouched', () => {
    const base = input();
    const withSpike = { ...base, hrv: replaceToday(base.hrv, base.date, 400) };
    const before = JSON.stringify(withSpike.hrv);
    const r = scoreDay(withSpike, cfg);

    expect(r.outlierFlags).toHaveLength(1);
    expect(r.outlierFlags[0]).toMatchObject({ metric: 'HRV', flag: { date: base.date, value: 400 } });
    expect(r.factors.find((f) => f.factor === 'HRV')!.imputed).toBe(true);
    expect(JSON.stringify(withSpike.hrv)).toBe(before); // flagged, never deleted or altered
  });

  it('does not let an outlier into the baseline it is later compared with', () => {
    const base = input();
    const spikeDay = shiftDate(base.date, -5);
    const spiked = { ...base, hrv: replaceToday(base.hrv, spikeDay, 400) };
    const clean = scoreDay(base, cfg);
    const withSpike = scoreDay(spiked, cfg);
    const eClean = (clean.baselines.find((b) => b.metric === 'HRV')!.baseline as { ewma: number }).ewma;
    const eSpike = (withSpike.baselines.find((b) => b.metric === 'HRV')!.baseline as { ewma: number }).ewma;
    expect(Math.abs(eSpike - eClean)).toBeLessThan(1);
  });

  it('stores acuteChronicLoadRatio but leaves it out of the composite', () => {
    const base = input();
    const a = scoreDay(base, cfg);
    const b = scoreDay({ ...base, steps: base.steps.map((p) => ({ ...p, value: p.date > shiftDate(base.date, -7) ? 30000 : p.value })) }, cfg);

    expect(a.features.acuteChronicLoadRatio).not.toBeNull();
    expect(b.features.acuteChronicLoadRatio).not.toBeNull();
    expect(b.features.acuteChronicLoadRatio).not.toBeCloseTo(a.features.acuteChronicLoadRatio!, 3);
    expect(b.score).toBe(a.score);
    expect(a.factors.map((f) => f.factor).sort()).toEqual(['HRV', 'RHR', 'SLEEP_DEBT']);
  });

  it('reads the sleep goal from the input rather than hardcoding 480', () => {
    const base = input();
    const low = scoreDay({ ...base, sleepGoalMinutes: 300 }, cfg);
    const high = scoreDay({ ...base, sleepGoalMinutes: 600 }, cfg);
    expect(low.features.sleepDebtRolling14d!).toBeLessThan(high.features.sleepDebtRolling14d!);
  });

  it('exposes the per-night sleep duration z and its imputed flag as a correlation series', () => {
    const base = input();
    const observed = scoreDay(base, cfg);
    expect(observed.features.sleepDurationZ).not.toBeNull();
    expect(observed.features.sleepDurationZImputed).toBe(false);

    const missing = scoreDay({ ...base, sleep: replaceToday(base.sleep, base.date, null) }, cfg);
    expect(missing.features.sleepDurationZ).toBeCloseTo(0, 12);
    expect(missing.features.sleepDurationZImputed).toBe(true);
    expect(missing.factors.find((f) => f.factor === 'SLEEP_DEBT')!.imputed).toBe(true);
  });

  it('reports no observed input when HRV, RHR and SLEEP are all missing on the day', () => {
    const base = input();
    const r = scoreDay(
      {
        ...base,
        hrv: replaceToday(base.hrv, base.date, null),
        rhr: replaceToday(base.rhr, base.date, null),
        sleep: replaceToday(base.sleep, base.date, null),
      },
      cfg,
    );
    expect(r.hasObservedInput).toBe(false);
  });

  it('ignores data after the scored day, so a recompute of a past day never sees the future', () => {
    const base = input({}, 40);
    const day = shiftDate(START, 34);
    const truncated = scoreDay({ ...base, date: day }, cfg);
    const withFuture = scoreDay({ ...base, date: day, hrv: [...base.hrv, { date: shiftDate(day, 3), value: 999 }] }, cfg);
    expect(withFuture).toEqual(truncated);
  });

  it('is deterministic: the same input scores identically every time (idempotent recompute)', () => {
    expect(scoreDay(input(), cfg)).toEqual(scoreDay(input(), cfg));
  });
});
