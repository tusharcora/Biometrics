// A challenge's week (spec 2026-10-15 §10.4; P4 ruling 5): the entrant's local ISO week, closing at their own Sunday
// 20:00, with results from Monday 08:00 UTC, when every zone's Sunday 20:00 has passed. Civil dates only through the
// helpers.
import { civilDateToUtcMidnight, localCivilDateOrUtc, localMidnightInstant } from '../biometrics/civilDate';
import { isoWeekKey } from '../habits/job';
import { weekNumber } from '../coins/shopWeeks';
import { shiftDate } from '../scoring/dates';

const HOUR_MS = 60 * 60 * 1000;

/** OWNER NOTE: a dev server may pin the challenge clock with CHALLENGE_NOW (an ISO instant) so the simulator check can
 * run a challenge week early. Ignored in production (PF4-F5), and the Jest setup deletes it. */
export function pinnedNow(env: NodeJS.ProcessEnv): Date | null {
  if (env.NODE_ENV === 'production' || !env.CHALLENGE_NOW) return null;
  const at = new Date(env.CHALLENGE_NOW);
  return Number.isNaN(at.getTime()) ? null : at;
}

const pinned = pinnedNow(process.env);
/** The routes' clock; tests move it, as coinsConfig.launchedAt is moved. */
export const challengeClock: { now: () => Date } = {
  now: () => (pinned ? new Date(pinned) : new Date()),
};

export function weekOf(now: Date, tz: string): string {
  return isoWeekKey(civilDateToUtcMidnight(localCivilDateOrUtc(now, tz)));
}

/** The Monday ('YYYY-MM-DD') of an ISO week: day numbers of Mondays are 4 mod 7 (1970-01-05 is day 4). */
export function mondayOf(weekId: string): string {
  const n = weekNumber(weekId);
  if (n === null) throw new Error('challenges: a malformed week');
  return new Date((n * 7 + 4) * 86_400_000).toISOString().slice(0, 10);
}

/** Sunday 20:00 in the zone: four hours before the next Monday begins there (exact unless the clocks change in those
 * four hours, which no zone's current rule does). */
export function closesAt(weekId: string, tz: string): Date {
  return new Date(localMidnightInstant(shiftDate(mondayOf(weekId), 7), tz).getTime() - 4 * HOUR_MS);
}

export function resultsAt(weekId: string): Date {
  return new Date(civilDateToUtcMidnight(shiftDate(mondayOf(weekId), 7)).getTime() + 8 * HOUR_MS);
}

export function previousWeek(weekId: string): string {
  return isoWeekKey(civilDateToUtcMidnight(shiftDate(mondayOf(weekId), -7)));
}
