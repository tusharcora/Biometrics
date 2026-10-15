// The first-week list (spec 2026-10-15 §11.2, C7): seven rows for seven days from day 1 (ruling 21). Two pay a bonus
// once ever, outside the daily cap: placing a first piece (+10; a P1 placement made before coins counts, the one
// exception to "no backpay", ruling 23) and 7 on-time check-ins in a row while the list is open (+25, ruling 22). The
// other rows tick when their normal earn's row exists (a 0-coin row at the cap still ticks), the fern on a bought fern
// (ruling 24). After day 7 the list is gone and an unfinished bonus lapses quietly.
// Day 1 is set only by a look at the list or by a sign-up after the launch (ruling PF-F3): a background earn reads it
// and never writes it, so an older account's week waits for the P2 app, and so do its bonuses.
import { familyDef } from '../achievements/catalogue';
import { civilDateToUtcMidnight, localCivilDateOrUtc, utcMidnightToCivilDate } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { habitDayForOrUtc } from '../habits/habitDay';
import { TIER_GATES } from '../room/tiers';
import { daysBetween, shiftDate } from '../scoring/dates';
import type { CoinEarn } from './ledger';

export const FIRST_WEEK_DAYS = 7;
export const FIRST_WEEK_BONUS = { place: 10, streak7: 25 } as const;
export const FIRST_WEEK_TASKS = ['checkin', 'place', 'sleep', 'fern', 'cheer', 'recap', 'streak7'] as const;
export type FirstWeekTask = (typeof FIRST_WEEK_TASKS)[number];
/** What each row shows (C7): the normal earn, the two bonuses, and the fern's price as a spend. */
export const TASK_REWARDS: Readonly<Record<FirstWeekTask, number>> = { checkin: 5, place: 10, sleep: 20, fern: -40, cheer: 2, recap: 10, streak7: 25 };

export function lastDay(startedOn: string): string {
  return shiftDate(startedOn, FIRST_WEEK_DAYS - 1);
}

/** The on-time check-in run ending today, or yesterday while today's is still due (the CHECK_IN family's rule). */
export function checkInRun(days: ReadonlySet<string>, habitToday: string): number {
  let d = days.has(habitToday) ? habitToday : shiftDate(habitToday, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

export interface BonusFacts { startedOn: string; today: string; firstPlacedOn: string | null; run: number }

export function bonusEarns(f: BonusFacts): CoinEarn[] {
  const end = lastDay(f.startedOn);
  const out: CoinEarn[] = [];
  if (f.firstPlacedOn !== null && f.firstPlacedOn <= end) out.push({ kind: 'firstweek', sourceKey: 'firstweek:place', amount: FIRST_WEEK_BONUS.place, capDay: null });
  if (f.today <= end && f.run >= 7) out.push({ kind: 'firstweek', sourceKey: 'firstweek:streak7', amount: FIRST_WEEK_BONUS.streak7, capDay: null });
  return out;
}

interface Known { startedOn: string | null; signUpDay: string | null; timezone: string }

/** The stored day 1, and the local sign-up date when the account was made at or after the launch (its day 1 even
 * before it is written). Null fields for an unknown user. */
async function knownStart(userId: string, launchedAt: Date): Promise<Known | null> {
  const [user, row] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, createdAt: true } }),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { startedOn: true } }),
  ]);
  if (!user) return null;
  return {
    startedOn: row?.startedOn ? utcMidnightToCivilDate(row.startedOn) : null,
    signUpDay: user.createdAt >= launchedAt ? localCivilDateOrUtc(user.createdAt, user.timezone) : null,
    timezone: user.timezone,
  };
}

/** Day 1 (ruling 21), set once by a look at the list: the local sign-up date for an account made at or after the
 * launch, else today. Null before the launch. */
export async function ensureStartedOn(userId: string, now: Date, launchedAt: Date): Promise<string | null> {
  if (now < launchedAt) return null;
  const known = await knownStart(userId, launchedAt);
  if (!known) return null;
  if (known.startedOn) return known.startedOn;
  const first = known.signUpDay ?? localCivilDateOrUtc(now, known.timezone);
  // Never on CosmeticLoadout (spec §11.1): a row made for a flag would turn the first save into a false 409.
  await prisma.roomFirstWeek.createMany({ data: [{ userId }], skipDuplicates: true });
  await prisma.roomFirstWeek.updateMany({ where: { userId, startedOn: null }, data: { startedOn: civilDateToUtcMidnight(first) } });
  const row = await prisma.roomFirstWeek.findUniqueOrThrow({ where: { userId }, select: { startedOn: true } });
  return utcMidnightToCivilDate(row.startedOn!);
}

/** The bonuses this run may pay (the ledger drops the ones already paid). Reads day 1, never writes it (PF-F3). */
export async function firstWeekEarns(userId: string, now: Date, launchedAt: Date): Promise<CoinEarn[]> {
  if (now < launchedAt) return [];
  const known = await knownStart(userId, launchedAt);
  const startedOn = known?.startedOn ?? known?.signUpDay;
  if (!known || !startedOn) return [];
  const tz = known.timezone;
  const habitToday = habitDayForOrUtc(now, tz);
  const [row, checkIns] = await Promise.all([
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { firstPlacedAt: true } }),
    prisma.habitCheckIn.findMany({
      where: { userId, onTime: true, habitDay: { gte: civilDateToUtcMidnight(shiftDate(habitToday, -2 * FIRST_WEEK_DAYS)) } },
      select: { habitDay: true },
    }),
  ]);
  return bonusEarns({
    startedOn,
    today: localCivilDateOrUtc(now, tz),
    firstPlacedOn: row?.firstPlacedAt ? localCivilDateOrUtc(row.firstPlacedAt, tz) : null,
    run: checkInRun(new Set(checkIns.map((c) => utcMidnightToCivilDate(c.habitDay))), habitToday),
  });
}

export type FirstWeekDTO =
  | { open: false }
  | { open: true; day: number; done: number; tasks: Array<{ key: FirstWeekTask; done: boolean; reward: number }>; next: { tier: 2; coins: number; streak: number } };

export async function readFirstWeek(userId: string, now: Date, launchedAt: Date): Promise<FirstWeekDTO> {
  const startedOn = await ensureStartedOn(userId, now, launchedAt);
  if (!startedOn) return { open: false };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  const today = localCivilDateOrUtc(now, user.timezone);
  if (today > lastDay(startedOn)) return { open: false };
  const [kinds, row, fern, streak] = await Promise.all([
    prisma.coinEvent.findMany({ where: { userId, kind: { in: ['checkin', 'sleep_goal', 'cheer_given', 'recap'] } }, distinct: ['kind'], select: { kind: true } }),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { firstPlacedAt: true } }),
    prisma.itemGrant.findFirst({ where: { userId, itemId: 'plant.fern', sourceKey: { startsWith: 'buy:' } }, select: { id: true } }),
    prisma.coinEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey: 'firstweek:streak7' } }, select: { id: true } }),
  ]);
  const has = new Set<string>(kinds.map((k) => k.kind));
  const ticked: Record<FirstWeekTask, boolean> = {
    checkin: has.has('checkin'), place: !!row?.firstPlacedAt, sleep: has.has('sleep_goal'), fern: !!fern,
    cheer: has.has('cheer_given'), recap: has.has('recap'), streak7: !!streak,
  };
  const tasks = FIRST_WEEK_TASKS.map((k) => ({ key: k, done: ticked[k], reward: TASK_REWARDS[k] }));
  const gate = TIER_GATES[2];
  return {
    open: true,
    // A zone moved west after day 1 could read the day before it: never below day 1.
    day: Math.max(1, daysBetween(startedOn, today) + 1),
    done: tasks.filter((t) => t.done).length,
    tasks,
    next: { tier: 2, coins: gate.price, streak: familyDef(gate.family).thresholds[gate.level - 1]! },
  };
}
