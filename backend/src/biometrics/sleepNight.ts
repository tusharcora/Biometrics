import { prisma } from '../db/client';
import { civilDateToUtcMidnight, localClockTime, sessionEndCivilDate } from './civilDate';
import { pickMainSession } from './mainSession';

const DAY_MS = 24 * 60 * 60 * 1000;
// "Usual" is the mean over the 30 nights before this one, and only once at
// least 7 of them have data: fewer is too thin to call anything usual.
const USUAL_WINDOW_NIGHTS = 30;
const USUAL_MIN_NIGHTS = 7;

type StageType = 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM';
type StageTotal = { minutes: number; count: number };

export interface SleepNightDetailDTO {
  /** The local civil date the night ENDED on. */
  date: string;
  /** Local "HH:MM" start and end of the main session, on its own clock. */
  bedtime: string;
  wakeTime: string;
  minutesAsleep: number;
  /** Google's sleep period when reported, else the session's interval. */
  minutesInBed: number;
  minutesAwake: number | null;
  minutesToFallAsleep: number | null;
  minutesAfterWakeUp: number | null;
  /** Whether the main session has a DEEP, LIGHT or REM stage: AWAKE alone is not stages. */
  hasStages: boolean;
  /** The main session's stage timeline (ISO instants) by start time; [] without stages. */
  stages: { type: StageType; start: string; end: string }[];
  /** Minutes from the session's stage summary, count from its stored segments; null without stages. */
  stageTotals: { deep: StageTotal; light: StageTotal; rem: StageTotal; awake: StageTotal } | null;
  /** Every other session ending that date. */
  naps: { start: string; end: string; minutesAsleep: number }[];
  sleepScore: number | null;
  /** Mean minutes asleep over the 30 nights before this date; null unless 7 or more have data. */
  usualMinutesAsleep: number | null;
}

/**
 * One night in full, for the night screen: the main session (the same rule as
 * /me/sleep and scoring) with its stage timeline, plus the naps ending that
 * date. Null when no session ends on `date`.
 */
export async function getSleepNight(userId: string, date: string): Promise<SleepNightDetailDTO | null> {
  const day = civilDateToUtcMidnight(date);

  const [user, sessions, score, previous] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    // A local date spans at most [D - 14h, D + 1d + 12h) in UTC, so a day of
    // margin each side holds every session ending on it.
    prisma.sleepSession.findMany({
      where: { userId, endTime: { gte: new Date(day.getTime() - DAY_MS), lt: new Date(day.getTime() + 2 * DAY_MS) } },
      include: { stages: { orderBy: { startTime: 'asc' } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.dailyScore.findUnique({
      where: { userId_date_type: { userId, date: day, type: 'SLEEP' } },
      select: { score: true },
    }),
    prisma.biometricRecord.findMany({
      where: {
        userId, metricType: 'SLEEP',
        recordedAt: { gte: new Date(day.getTime() - USUAL_WINDOW_NIGHTS * DAY_MS), lt: day },
      },
      select: { value: true },
    }),
  ]);
  const timeZone = user?.timezone ?? 'UTC';

  const own = sessions.filter((s) => sessionEndCivilDate(s, timeZone) === date);
  const main = pickMainSession(own);
  if (!main) return null;

  const hasStages = main.stages.some((st) => st.type !== 'AWAKE');
  const total = (type: StageType, minutes: number | null): StageTotal => ({
    minutes: minutes ?? 0,
    count: main.stages.filter((st) => st.type === type).length,
  });

  return {
    date,
    bedtime: localClockTime(main.startTime, main.startUtcOffsetSeconds, timeZone),
    wakeTime: localClockTime(main.endTime, main.endUtcOffsetSeconds, timeZone),
    minutesAsleep: main.minutesAsleep,
    minutesInBed: main.minutesInSleepPeriod ?? Math.round((main.endTime.getTime() - main.startTime.getTime()) / 60000),
    minutesAwake: main.minutesAwake,
    minutesToFallAsleep: main.minutesToFallAsleep,
    minutesAfterWakeUp: main.minutesAfterWakeUp,
    hasStages,
    stages: hasStages
      ? main.stages.map((st) => ({ type: st.type, start: st.startTime.toISOString(), end: st.endTime.toISOString() }))
      : [],
    stageTotals: hasStages
      ? {
        deep: total('DEEP', main.deepMinutes),
        light: total('LIGHT', main.lightMinutes),
        rem: total('REM', main.remMinutes),
        awake: total('AWAKE', main.awakeMinutes),
      }
      : null,
    naps: own
      .filter((s) => s !== main)
      .map((s) => ({ start: s.startTime.toISOString(), end: s.endTime.toISOString(), minutesAsleep: s.minutesAsleep })),
    sleepScore: score?.score == null ? null : Math.round(score.score),
    usualMinutesAsleep: previous.length >= USUAL_MIN_NIGHTS
      ? Math.round(previous.reduce((sum, r) => sum + r.value, 0) / previous.length)
      : null,
  };
}
