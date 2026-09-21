import { runBacktest, parseArgs } from '../../scripts/backtest';
import { backtest, formatReport, BACKTEST_DISCLAIMER, CHANGE_THRESHOLD_POINTS, BacktestUserData } from '../../src/scoring/backtest';
import { v1Config } from '../../src/scoring/configs/v1';
import { getScoreConfig } from '../../src/scoring/configs';
import { shiftDate } from '../../src/scoring/dates';
import type { DailyPoint } from '../../src/scoring/types';
import { prisma } from '../../src/db/client';

afterAll(async () => {
  await prisma.$disconnect();
});

const START = '2026-05-01';

function wave(days: number, base: number, amp: number, phase = 0): DailyPoint[] {
  return Array.from({ length: days }, (_, i) => ({ date: shiftDate(START, i), value: base + amp * Math.sin((i + phase) * 1.7) }));
}

function syntheticUser(userId = 'synthetic'): BacktestUserData {
  const days = 80;
  return {
    userId,
    hrv: wave(days, 50, 4),
    rhr: wave(days, 55, 2, 1),
    sleep: wave(days, 450, 30, 2),
    steps: wave(days, 8000, 1500, 3),
    sleepGoalMinutes: 480,
  };
}

const NOW = new Date(`${shiftDate(START, 79)}T12:00:00Z`);

describe('backtest', () => {
  it('shows no change when the candidate is the live config', async () => {
    const report = await runBacktest({
      candidate: v1Config,
      days: 30,
      now: NOW,
      loadUsers: async () => [syntheticUser()],
    });

    expect(report.days.length).toBeGreaterThan(0);
    expect(report.comparedDays).toBeGreaterThan(0);
    expect(report.changedOverThreshold).toBe(0);
    expect(report.maxAbsDelta).toBe(0);
    expect(report.days.every((d) => d.delta === 0 || d.delta === null)).toBe(true);
  });

  it('reports per-day deltas and counts days moved by more than 10 points when a candidate reweights', async () => {
    // A hypothetical v2: lean almost entirely on HRV and steepen the squash.
    const candidate = { ...v1Config, version: 'v2-test', weights: { HRV: 0.9, RHR: 0.05, SLEEP_DEBT: 0.05 }, k: (Math.log(9) / 2) * 4 };

    const report = await runBacktest({ candidate, days: 30, now: NOW, loadUsers: async () => [syntheticUser()] });

    expect(report.liveVersion).toBe('v1');
    expect(report.candidateVersion).toBe('v2-test');
    const scored = report.days.filter((d) => d.delta !== null);
    expect(scored.length).toBeGreaterThan(0);
    for (const d of scored) expect(d.delta).toBeCloseTo(d.candidate! - d.live!, 9);
    expect(report.changedOverThreshold).toBe(scored.filter((d) => Math.abs(d.delta!) > CHANGE_THRESHOLD_POINTS).length);
    expect(report.changedOverThreshold).toBeGreaterThan(0);
    expect(report.maxAbsDelta).toBeGreaterThan(CHANGE_THRESHOLD_POINTS);
  });

  it('replays only the requested window', async () => {
    const report = await runBacktest({ candidate: v1Config, days: 10, now: NOW, loadUsers: async () => [syntheticUser()] });
    expect(report.days).toHaveLength(10);
    expect(report.days[0]!.date).toBe(shiftDate(START, 70));
  });

  it('states in its output that it is a regression check, not a correctness validation', () => {
    const report = backtest([syntheticUser()], v1Config, { ...v1Config, version: 'v2-test' }, { from: shiftDate(START, 60), to: shiftDate(START, 79) });
    const text = formatReport(report);
    expect(text).toContain('REGRESSION CHECK, NOT A CORRECTNESS VALIDATION');
    expect(text).toContain(BACKTEST_DISCLAIMER);
    expect(text).toContain('live v1  vs  candidate v2-test');
  });

  it('is read-only: it needs no DB writes and never touches a database when given a loader', async () => {
    const spy = jest.spyOn(prisma.dailyScore, 'upsert');
    await runBacktest({ candidate: v1Config, days: 5, now: NOW, loadUsers: async () => [syntheticUser()] });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('backtest CLI', () => {
  it('parses arguments and requires --candidate', () => {
    expect(parseArgs(['--candidate', 'v2', '--days', '30', '--user', 'u1'])).toEqual({ candidate: 'v2', live: undefined, days: 30, userId: 'u1' });
    expect(() => parseArgs([])).toThrow('--candidate');
    expect(() => parseArgs(['--candidate', 'v2', '--bogus'])).toThrow('Unknown argument');
    expect(() => parseArgs(['--candidate', 'v2', '--days', '0'])).toThrow('--days');
  });

  it('rejects an unknown config version instead of silently scoring with the wrong one', () => {
    expect(() => getScoreConfig('v99')).toThrow('Unknown score algorithm version');
  });
});
