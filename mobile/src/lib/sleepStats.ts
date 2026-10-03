// Pure statistics and formatting for the Sleep page of the activity heat map.
// Nights are keyed by the civil date they ended on, like the server's rollup.

import type { SleepNight } from '../api/sleep';
import { addDays } from './heatmap';

export type SleepByDate = ReadonlyMap<string, SleepNight>;

export interface SleepRangeStats {
  nights: number;
  // Average over nights that HAVE a record, like the steps average.
  averageMinutes: number | null;
  goalNights: number;
  // Consecutive nights at or above goal ending at the range's last night. A
  // night is over by the morning it is keyed to, so today counts once it has
  // a record; with none yet, the streak is counted up to yesterday.
  streak: number;
  // Noon-anchored average of the main sleep's start, as "HH:MM".
  averageBedtime: string | null;
  longest: { date: string; minutes: number } | null;
}

/** "23:52" -> minutes after 12:00, so 23:30 and 00:30 are an hour apart, not 23. */
function minutesSinceNoon(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return (h * 60 + m - 12 * 60 + 24 * 60) % (24 * 60);
}

function clockFromMinutesSinceNoon(minutes: number): string {
  const total = (Math.round(minutes) + 12 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function sleepRangeStats(sleep: SleepByDate, start: string, end: string, today: string, goal: number): SleepRangeStats {
  const last = end < today ? end : today;
  let nights = 0;
  let total = 0;
  let goalNights = 0;
  let longest: SleepRangeStats['longest'] = null;
  let bedtimeSum = 0;
  let bedtimes = 0;
  for (let date = start; date <= last; date = addDays(date, 1)) {
    const night = sleep.get(date);
    if (!night) continue;
    nights++;
    total += night.minutesAsleep;
    if (night.minutesAsleep >= goal) goalNights++;
    if (!longest || night.minutesAsleep > longest.minutes) longest = { date, minutes: night.minutesAsleep };
    if (night.bedtime) {
      bedtimeSum += minutesSinceNoon(night.bedtime);
      bedtimes++;
    }
  }

  let streak = 0;
  let cursor = last;
  if (cursor === today && !sleep.has(today)) cursor = addDays(cursor, -1);
  while (cursor >= start && (sleep.get(cursor)?.minutesAsleep ?? 0) >= goal) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return {
    nights,
    averageMinutes: nights > 0 ? total / nights : null,
    goalNights,
    streak,
    averageBedtime: bedtimes > 0 ? clockFromMinutesSinceNoon(bedtimeSum / bedtimes) : null,
    longest,
  };
}

/** 467 -> "7h 47m". */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** 25 -> "25m", 80 -> "1h 20m": short spans without the leading "0h". */
export function formatShortDuration(minutes: number): string {
  const m = Math.round(minutes);
  return m < 60 ? `${m}m` : formatDuration(m);
}

/** "23:52" -> "11:52 pm". */
export function formatClock(clock: string): string {
  const [h, m] = clock.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

/** One line comparing a night to the visible range's average; null when there is nothing to compare. */
export function compareSleepToAverage(minutes: number, average: number | null): string | null {
  if (average === null || average <= 0) return null;
  const diff = Math.round(minutes - average);
  if (Math.abs(diff) < 5) return 'In line with your average for this range.';
  return `${formatDuration(Math.abs(diff)).replace(/^0h /, '')} ${diff > 0 ? 'more' : 'less'} than your average for this range.`;
}
