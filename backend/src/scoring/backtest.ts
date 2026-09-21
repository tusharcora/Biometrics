// Pure core of the backtest tool (scripts/backtest.ts does the DB loading and
// printing). Replays stored history through two config versions and diffs the
// resulting scores, using the SAME scoreDay the live job uses, so a diff can
// only ever come from the config difference.

import type { ScoreConfig } from './configs/v1';
import { scoreDay } from './pipeline';
import type { DailyPoint } from './types';

/** A day whose score moves by more than this is called out (spec §3: "flip more than 10 points"). */
export const CHANGE_THRESHOLD_POINTS = 10;

export const BACKTEST_DISCLAIMER =
  'REGRESSION CHECK, NOT A CORRECTNESS VALIDATION. This shows what changed between two algorithm ' +
  'versions on historical data ("did this change do something bigger than I expected"). There is no ' +
  'ground-truth recovery label to validate against, so it cannot say either version is more accurate.';

export interface BacktestUserData {
  userId: string;
  hrv: DailyPoint[];
  rhr: DailyPoint[];
  sleep: DailyPoint[];
  steps: DailyPoint[];
  sleepGoalMinutes: number;
}

export interface DayDiff {
  userId: string;
  date: string;
  live: number | null;
  candidate: number | null;
  /** candidate - live; null when either side has no score (cold start under one version only). */
  delta: number | null;
}

export interface BacktestReport {
  liveVersion: string;
  candidateVersion: string;
  days: DayDiff[];
  /** Days where both versions produced a score. */
  comparedDays: number;
  /** Days where |delta| > CHANGE_THRESHOLD_POINTS. */
  changedOverThreshold: number;
  /** Days scored under exactly one version. */
  scoredByOneVersionOnly: number;
  meanAbsDelta: number;
  maxAbsDelta: number;
}

/** Every date with an observed score input inside [from, to], ascending. */
function replayDates(user: BacktestUserData, from: string, to: string): string[] {
  const dates = new Set<string>();
  for (const p of [...user.hrv, ...user.rhr, ...user.sleep]) {
    if (p.date >= from && p.date <= to) dates.add(p.date);
  }
  return [...dates].sort();
}

export function backtest(
  users: BacktestUserData[],
  live: ScoreConfig,
  candidate: ScoreConfig,
  range: { from: string; to: string },
): BacktestReport {
  const days: DayDiff[] = [];

  for (const user of users) {
    for (const date of replayDates(user, range.from, range.to)) {
      const input = { date, hrv: user.hrv, rhr: user.rhr, sleep: user.sleep, steps: user.steps, sleepGoalMinutes: user.sleepGoalMinutes };
      const l = scoreDay(input, live);
      if (!l.hasObservedInput) continue;
      const c = scoreDay(input, candidate);
      days.push({
        userId: user.userId,
        date,
        live: l.score,
        candidate: c.score,
        delta: l.score !== null && c.score !== null ? c.score - l.score : null,
      });
    }
  }

  const deltas = days.map((d) => d.delta).filter((d): d is number => d !== null);
  const abs = deltas.map(Math.abs);
  return {
    liveVersion: live.version,
    candidateVersion: candidate.version,
    days,
    comparedDays: deltas.length,
    changedOverThreshold: abs.filter((d) => d > CHANGE_THRESHOLD_POINTS).length,
    scoredByOneVersionOnly: days.filter((d) => (d.live === null) !== (d.candidate === null)).length,
    meanAbsDelta: abs.length === 0 ? 0 : abs.reduce((s, d) => s + d, 0) / abs.length,
    maxAbsDelta: abs.length === 0 ? 0 : Math.max(...abs),
  };
}

const fmt = (n: number | null) => (n === null ? '  -  ' : n.toFixed(1).padStart(5));

export function formatReport(report: BacktestReport, { maxRows = 60 }: { maxRows?: number } = {}): string {
  const changed = report.days
    .filter((d) => d.delta === null ? d.live !== d.candidate : Math.abs(d.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta ?? Infinity) - Math.abs(a.delta ?? Infinity));

  const lines = [
    BACKTEST_DISCLAIMER,
    '',
    `live ${report.liveVersion}  vs  candidate ${report.candidateVersion}`,
    `  days replayed:                       ${report.days.length}`,
    `  days scored under both versions:     ${report.comparedDays}`,
    `  days changed by more than ${CHANGE_THRESHOLD_POINTS} points:    ${report.changedOverThreshold}`,
    `  days scored under only one version:  ${report.scoredByOneVersionOnly}`,
    `  mean |delta|: ${report.meanAbsDelta.toFixed(2)}   max |delta|: ${report.maxAbsDelta.toFixed(2)}`,
  ];
  if (changed.length > 0) {
    lines.push('', 'largest per-day changes (user, date, live, candidate, delta):');
    for (const d of changed.slice(0, maxRows)) {
      lines.push(`  ${d.userId}  ${d.date}  ${fmt(d.live)}  ${fmt(d.candidate)}  ${d.delta === null ? '  n/a' : (d.delta >= 0 ? '+' : '') + d.delta.toFixed(1)}`);
    }
    if (changed.length > maxRows) lines.push(`  ... ${changed.length - maxRows} more`);
  }
  return lines.join('\n');
}
