// KIP coins from healthy days (spec 2026-10-15 §6.2): each source, its amount, its key and its cap day, built from the
// records the app already keeps and written by the ledger. Only measured data pays (sleep and steps come from the
// health sync); the check-in is the one self-reported source. No backpay: a source dated before the user's local date
// of the coins launch writes nothing. An event stores a kind, a key, an amount and a civil date, never a health value.
// A background earn never starts the first week (ruling PF-F3): it only reads day 1 to pay the first-week bonuses.
import { civilDateToUtcMidnight, localCivilDateOrUtc, localMidnightInstant, utcMidnightToCivilDate } from '../biometrics/civilDate';
import { changeInEffect, goalChangesOf, type GoalChangeRow } from '../achievements/goalHistory';
import { prisma } from '../db/client';
import { habitDayForOrUtc } from '../habits/habitDay';
import { loadRecapData } from '../recap/data';
import { dateRange, shiftDate } from '../scoring/dates';
import { resolveSleepGoalMinutes } from '../users/goals';
import { EARN_AMOUNTS } from './amounts';
import { firstWeekEarns } from './firstWeek';
import { applyCoinEvents, type CoinEarn } from './ledger';

/** OWNER NOTE (plan ruling 1): the instant P2 reaches users, set at merge. A dev server may move it with the
 * COINS_LAUNCHED_AT environment variable (an ISO instant); tests move it directly (the Jest setup parks it in 2100). */
const launchFromEnv = process.env.COINS_LAUNCHED_AT ? new Date(process.env.COINS_LAUNCHED_AT) : null;
export const coinsConfig: { launchedAt: Date } = {
  launchedAt: launchFromEnv && !Number.isNaN(launchFromEnv.getTime()) ? launchFromEnv : new Date('2026-10-20T00:00:00.000Z'),
};
export { EARN_AMOUNTS };
/** Each run reads this many civil days back (spec §6.3), so a night synced late still pays. */
export const LOOKBACK_DAYS = 8;

export interface EarnInputs {
  /** The user's local civil date of the coins launch: nothing dated before it pays. */
  launchDay: string;
  /** Wake dates whose SLEEP rollup met the goal in effect that night. */
  sleepGoalNights: readonly string[];
  /** Local dates with a StepGoalEvent. */
  stepGoalDays: readonly string[];
  /** Habit days with an on-time check-in (the one the CHECK_IN badge counts). */
  onTimeCheckIns: readonly string[];
  /** WEEK recaps opened, with the open's local date. */
  weekRecapOpens: ReadonlyArray<{ id: string; day: string }>;
}

export function planEarns(inp: EarnInputs): CoinEarn[] {
  const paid = (d: string) => d >= inp.launchDay;
  return [
    ...inp.sleepGoalNights.filter(paid).map((d): CoinEarn => ({ kind: 'sleep_goal', sourceKey: `sleep_goal:${d}`, amount: EARN_AMOUNTS.sleep_goal, capDay: d })),
    ...inp.stepGoalDays.filter(paid).map((d): CoinEarn => ({ kind: 'steps', sourceKey: `steps:${d}`, amount: EARN_AMOUNTS.steps, capDay: d })),
    ...inp.onTimeCheckIns.filter(paid).map((d): CoinEarn => ({ kind: 'checkin', sourceKey: `checkin:${d}`, amount: EARN_AMOUNTS.checkin, capDay: d })),
    ...inp.weekRecapOpens.filter((r) => paid(r.day)).map((r): CoinEarn => ({ kind: 'recap', sourceKey: `recap:${r.id}`, amount: EARN_AMOUNTS.recap, capDay: r.day })),
  ];
}

/** The source records of the last LOOKBACK_DAYS local days; null for an unknown user. */
export async function loadEarnInputs(userId: string, now: Date, launchedAt: Date = coinsConfig.launchedAt): Promise<EarnInputs | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, sleepGoalMinutes: true } });
  if (!user) return null;
  const tz = user.timezone;
  const today = localCivilDateOrUtc(now, tz);
  const from = shiftDate(today, -(LOOKBACK_DAYS - 1));
  const habitFrom = shiftDate(habitDayForOrUtc(now, tz), -(LOOKBACK_DAYS - 1));
  const [data, changes, steps, checkIns, recaps] = await Promise.all([
    loadRecapData(userId, tz, from, today, { bedtimes: false }),
    prisma.goalChange.findMany({ where: { userId, kind: 'SLEEP_MINUTES' } }),
    prisma.stepGoalEvent.findMany({ where: { authorId: userId, localDate: { gte: civilDateToUtcMidnight(from) } }, select: { localDate: true } }),
    prisma.habitCheckIn.findMany({ where: { userId, onTime: true, habitDay: { gte: civilDateToUtcMidnight(habitFrom) } }, select: { habitDay: true } }),
    prisma.recap.findMany({
      // Opened on or after `from`'s local midnight: the same 8 civil days as every other source.
      where: { userId, kind: 'WEEK', openedAt: { gte: localMidnightInstant(from, tz) } },
      select: { id: true, openedAt: true },
    }),
  ]);
  const rows: GoalChangeRow[] = changes.map((c) => ({
    kind: c.kind, sleepMinutes: c.sleepMinutes, bedtime: c.bedtime, effectiveOn: utcMidnightToCivilDate(c.effectiveOn), resetsStreak: c.resetsStreak,
  }));
  const sleepChanges = goalChangesOf(rows, 'SLEEP_MINUTES');
  const stored = resolveSleepGoalMinutes(user.sleepGoalMinutes);
  // The SLEEP_GOAL badge's own marker per night (ruling 27): the goal in effect that night, else the stored goal.
  const sleepGoalNights = dateRange(from, today).filter((d) => {
    const minutes = data.get(d)?.sleepMinutes;
    return minutes !== undefined && minutes > 0 && minutes >= (changeInEffect(sleepChanges, d)?.sleepMinutes ?? stored);
  });
  return {
    launchDay: localCivilDateOrUtc(launchedAt, tz),
    sleepGoalNights,
    stepGoalDays: steps.map((s) => utcMidnightToCivilDate(s.localDate)).sort(),
    onTimeCheckIns: checkIns.map((c) => utcMidnightToCivilDate(c.habitDay)).sort(),
    // The gte bound never matches a null openedAt; the column's type is nullable, hence the assertion.
    weekRecapOpens: recaps.map((r) => ({ id: r.id, day: localCivilDateOrUtc(r.openedAt as Date, tz) })),
  };
}

/** Pays every source of the last 8 days not paid yet (idempotent). Answers the number of rows written. */
export async function earnCoins(userId: string, now: Date, opts: { launchedAt?: Date } = {}): Promise<number> {
  const launchedAt = opts.launchedAt ?? coinsConfig.launchedAt;
  const inputs = await loadEarnInputs(userId, now, launchedAt);
  if (!inputs) return 0;
  // The first-week bonuses are outside the cap and, for a P1 placement, outside "no backpay" (spec §11.2).
  const events = [...planEarns(inputs), ...(await firstWeekEarns(userId, now, launchedAt))];
  return (await applyCoinEvents(userId, events, now)).length;
}

/** The earn the hooks call; tests swap it to prove a failure never fails the request that triggered it. */
export const coinsHooks: { earn: (userId: string, now: Date) => Promise<unknown> } = {
  earn: (userId, now) => earnCoins(userId, now),
};

/** Never throws: a failed earn is logged with its error class only, and the next GET /me/coins catches up. */
export async function earnCoinsSafely(userId: string, now: Date): Promise<void> {
  try {
    await coinsHooks.earn(userId, now);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'coins.earn_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}
