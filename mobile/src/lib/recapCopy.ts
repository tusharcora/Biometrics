import type { RecapComparison, RecapKind, RecapMilestones, RecapStats } from '../api/recaps';
import { MONTH_LONG, MONTH_SHORT } from './heatmap';
import { formatDuration, formatShortDuration } from './sleepStats';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export function monthName(periodStart: string): string {
  return MONTH_LONG[Number(periodStart.slice(5, 7)) - 1]!;
}

export function shortDate(date: string): string {
  return `${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

export function weekdayName(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

export function recapTitle(r: { kind: RecapKind; periodStart: string }): string {
  return r.kind === 'MONTH' ? `${monthName(r.periodStart)} ${r.periodStart.slice(0, 4)}` : `Week of ${shortDate(r.periodStart)}`;
}

export function readyCardTitle(r: { kind: RecapKind; periodStart: string }): string {
  return r.kind === 'MONTH' ? `Your ${monthName(r.periodStart)} recap is ready` : 'Your week is ready';
}

/** 480 → "8h", 450 → "7h 30m". */
export function goalLabel(minutes: number): string {
  const m = Math.round(minutes);
  return m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export type CardStatKey = 'avgSleep' | 'streak' | 'bestRecovery' | 'steps';
export interface CardStat {
  key: CardStatKey;
  label: string;
  value: string;
}

/** The monthly card's stats, in a fixed order (spec §3: avg sleep, longest streak, best recovery, steps). */
export function cardStats(stats: RecapStats): CardStat[] {
  const out: CardStat[] = [];
  if (stats.avgSleepMinutes !== undefined) out.push({ key: 'avgSleep', label: 'Avg sleep', value: formatDuration(stats.avgSleepMinutes) });
  if ((stats.longestOnGoalStreak ?? 0) > 0) out.push({ key: 'streak', label: 'Longest streak', value: plural(stats.longestOnGoalStreak!, 'night') });
  if (stats.bestRecovery) out.push({ key: 'bestRecovery', label: 'Best recovery', value: String(stats.bestRecovery.score) });
  if (stats.steps) out.push({ key: 'steps', label: 'Steps a day', value: stats.steps.dailyAverage.toLocaleString('en-US') });
  return out;
}

export interface CompareRow {
  key: 'avgSleep' | 'spread' | 'recovery';
  arrow: '↑' | '↓' | '=';
  text: string;
}

const arrowOf = (d: number): CompareRow['arrow'] => (d > 0 ? '↑' : d < 0 ? '↓' : '=');

/** "Compared with last month": only the comparisons the server could make. */
export function compareRows(c: RecapComparison | undefined): CompareRow[] {
  const rows: CompareRow[] = [];
  if (c?.avgSleepDelta !== undefined) {
    const d = c.avgSleepDelta;
    rows.push({ key: 'avgSleep', arrow: arrowOf(d), text: d === 0 ? 'Same sleep a night' : `${formatShortDuration(Math.abs(d))} ${d > 0 ? 'more' : 'less'} sleep a night` });
  }
  if (c?.bedtimeSpreadDelta !== undefined) {
    const d = c.bedtimeSpreadDelta;
    // A smaller spread is steadier bedtimes.
    rows.push({ key: 'spread', arrow: arrowOf(d), text: d === 0 ? 'Bedtimes as steady' : `Bedtimes ${formatShortDuration(Math.abs(d))} ${d < 0 ? 'steadier' : 'less steady'}` });
  }
  if (c?.avgRecoveryDelta !== undefined) {
    const d = c.avgRecoveryDelta;
    rows.push({ key: 'recovery', arrow: arrowOf(d), text: d === 0 ? 'Same recovery' : `Recovery ${plural(Math.abs(d), 'point')} ${d > 0 ? 'higher' : 'lower'}` });
  }
  return rows;
}

export function milestoneLines(m: RecapMilestones | undefined): Array<{ key: keyof RecapMilestones; text: string }> {
  const out: Array<{ key: keyof RecapMilestones; text: string }> = [];
  if (m?.streak) out.push({ key: 'streak', text: `${plural(m.streak.nights, 'night')} on goal in a row` });
  if (m?.bestRecoveryWeek) out.push({ key: 'bestRecoveryWeek', text: `Best recovery week, beating last month's: ${m.bestRecoveryWeek.avgRecovery} (week of ${shortDate(m.bestRecoveryWeek.weekStart)})` });
  if (m?.everyDayLogged) out.push({ key: 'everyDayLogged', text: 'Every night of the month logged' });
  if (m?.steadiestMonth) out.push({ key: 'steadiestMonth', text: `Your steadiest bedtimes yet (${formatShortDuration(m.steadiestMonth.spreadMinutes)} spread)` });
  return out;
}
