// What a buddy's mood is (spec 2026-10-06 buddies §5): the RECOVERY DailyScore with a score for the
// buddy's own local today, else yesterday, banded with the live score bands (the ones the scoring
// routes return). The mood line is fixed templates only, extended only by shared items.

import { loadAchievementInputs } from '../achievements/data';
import { sleepGoalDays } from '../achievements/families';
import { summariseRuns } from '../achievements/runs';
import { getLiveConfig } from '../scoring/configs';
import type { ScoreBands } from '../scoring/configs/v1';
import { shiftDate } from '../scoring/dates';

export type Mood = 'good' | 'ok' | 'low' | 'none';

export const MOOD_LINES: Readonly<Record<Mood, string>> = {
  good: 'Well rested',
  ok: 'Doing okay',
  low: 'Running low today',
  none: 'No data yet',
};

export const STREAK_LINE_MIN = 3;

/** excellent and good → good, fair → ok, poor → low; no score → none. */
export function moodFromScore(score: number | null | undefined, bands: ScoreBands = getLiveConfig().scoreBands): Mood {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'none';
  if (score >= bands.good) return 'good';
  if (score >= bands.fair) return 'ok';
  return 'low';
}

/** `scores`: local date → non-null RECOVERY score. Today's, else yesterday's. */
export function todayMood(scores: ReadonlyMap<string, number>, today: string, bands?: ScoreBands): Mood {
  return moodFromScore(scores.get(today) ?? scores.get(shiftDate(today, -1)), bands);
}

/**
 * The fixed line. `movedALot` must only be passed when the steps switch is on, `streakNights` only
 * when the streaks switch is on (and only on the buddy's week).
 */
export function moodLine(mood: Mood, extras: { movedALot?: boolean; streakNights?: number | null } = {}): string {
  const parts = [MOOD_LINES[mood]];
  if (extras.movedALot) parts.push('moved a lot yesterday');
  if (typeof extras.streakNights === 'number' && extras.streakNights >= STREAK_LINE_MIN) parts.push(`on a ${extras.streakNights}-night streak`);
  return parts.join(' · ');
}

/**
 * The buddy's current Sleep goal streak from the achievement inputs, WITHOUT evaluateAchievements
 * (which inserts awards): a read-only load and the pure run walk. null when the buddy has no
 * achievements start date (no streak at all, not 0).
 */
export async function currentSleepStreak(userId: string, now: Date): Promise<number | null> {
  const loaded = await loadAchievementInputs(userId, now);
  if (!loaded) return null;
  return summariseRuns(sleepGoalDays(loaded.inputs), { today: loaded.inputs.today, pausable: true }).current;
}
