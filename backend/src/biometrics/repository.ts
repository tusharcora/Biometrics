import { prisma } from '../db/client';
import { BiometricMetricType, HealthMetricPoint, SleepSessionPoint } from '../types';
import { localCivilDate, civilDateToUtcMidnight } from './civilDate';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function upsertBiometricRecords(
  userId: string,
  metricType: BiometricMetricType,
  points: HealthMetricPoint[],
): Promise<void> {
  for (const point of points) {
    await prisma.biometricRecord.upsert({
      where: { userId_metricType_recordedAt: { userId, metricType, recordedAt: point.recordedAt } },
      update: { value: point.value, syncedAt: new Date() },
      create: { userId, metricType, recordedAt: point.recordedAt, value: point.value },
    });
  }
}

/**
 * Stores whole sleep sessions, overwrite-on-match on (userId, startTime).
 * Re-fetching a session yields the same values, so every re-sync, retry and
 * overlapping window is a no-op; if Google revises a session the row converges
 * to the latest values. (Summing into a per-day row instead would double-count
 * on every repeat webhook, retried job and re-run backfill.)
 *
 * Returns the end instants this call touched -- the new end of every session
 * AND the previous end of any session whose end moved -- so the caller can
 * recompute every rollup date that may have changed, including the one a
 * revised session just left.
 */
export async function upsertSleepSessions(userId: string, sessions: SleepSessionPoint[]): Promise<Date[]> {
  if (sessions.length === 0) return [];

  // Last one wins if a batch repeats a startTime, matching what sequential
  // overwrite-upserts would leave behind.
  const byStart = new Map<number, SleepSessionPoint>();
  for (const s of sessions) byStart.set(s.startTime.getTime(), s);
  const unique = [...byStart.values()];

  const existing = await prisma.sleepSession.findMany({
    where: { userId, startTime: { in: unique.map((s) => s.startTime) } },
    select: { endTime: true },
  });

  await prisma.$transaction(
    unique.map((s) =>
      prisma.sleepSession.upsert({
        where: { userId_startTime: { userId, startTime: s.startTime } },
        update: { endTime: s.endTime, minutesAsleep: s.minutesAsleep, syncedAt: new Date() },
        create: { userId, startTime: s.startTime, endTime: s.endTime, minutesAsleep: s.minutesAsleep },
      }),
    ),
  );

  return [...unique.map((s) => s.endTime), ...existing.map((e) => e.endTime)];
}

async function timezoneOf(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user) throw new Error(`Cannot compute sleep rollups: user ${userId} not found`);
  return user.timezone;
}

// Sum of minutesAsleep per local civil date of each session's end instant.
function totalsByLocalDate(
  sessions: { endTime: Date; minutesAsleep: number }[],
  timeZone: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const date = localCivilDate(s.endTime, timeZone);
    totals.set(date, (totals.get(date) ?? 0) + s.minutesAsleep);
  }
  return totals;
}

// Materialize the rollup for each date from `totals`: overwrite when the date
// has sessions, delete the row when it has none left (e.g. its only session
// was revised onto another date). Always a full overwrite from the derived
// value, never an increment, so running it twice is a no-op.
function rollupWrites(userId: string, dates: string[], totals: Map<string, number>) {
  return dates.map((date) => {
    const recordedAt = civilDateToUtcMidnight(date);
    const total = totals.get(date);
    if (total === undefined) {
      return prisma.biometricRecord.deleteMany({ where: { userId, metricType: 'SLEEP', recordedAt } });
    }
    return prisma.biometricRecord.upsert({
      where: { userId_metricType_recordedAt: { userId, metricType: 'SLEEP', recordedAt } },
      update: { value: total, syncedAt: new Date() },
      create: { userId, metricType: 'SLEEP', recordedAt, value: total },
    });
  });
}

/**
 * Recomputes the SLEEP BiometricRecord rollup for each given local civil date
 * (YYYY-MM-DD in the user's timezone) from the FULL stored session set.
 * A fetch that only returned part of a day's sessions therefore can never
 * lower a total below what the stored sessions support.
 */
export async function recomputeSleepRollups(userId: string, civilDates: string[]): Promise<void> {
  const dates = [...new Set(civilDates)].sort();
  if (dates.length === 0) return;

  const timeZone = await timezoneOf(userId);
  // A local civil date spans at most [D 00:00 - 14h, D+1 00:00 + 12h) in UTC
  // across every real zone, so [D - 1d, D + 2d) always contains its sessions.
  // The exact bucketing is then done per-session with Intl, not by this range.
  const from = new Date(civilDateToUtcMidnight(dates[0]!).getTime() - DAY_MS);
  const to = new Date(civilDateToUtcMidnight(dates[dates.length - 1]!).getTime() + 2 * DAY_MS);
  const sessions = await prisma.sleepSession.findMany({
    where: { userId, endTime: { gte: from, lt: to } },
    select: { endTime: true, minutesAsleep: true },
  });

  await prisma.$transaction(rollupWrites(userId, dates, totalsByLocalDate(sessions, timeZone)));
}

/**
 * Rebuilds every SLEEP rollup for a user from scratch under their current
 * timezone. Used when the timezone changes: rollups keyed under the old zone
 * are dropped and the sessions re-bucketed, which is cheap because rollups
 * are derived.
 */
export async function recomputeAllSleepRollups(userId: string): Promise<void> {
  const timeZone = await timezoneOf(userId);
  const sessions = await prisma.sleepSession.findMany({
    where: { userId },
    select: { endTime: true, minutesAsleep: true },
  });
  const totals = totalsByLocalDate(sessions, timeZone);

  const existing = await prisma.biometricRecord.findMany({
    where: { userId, metricType: 'SLEEP' },
    select: { recordedAt: true },
  });
  const dates = new Set(totals.keys());
  for (const r of existing) dates.add(r.recordedAt.toISOString().slice(0, 10));

  await prisma.$transaction(rollupWrites(userId, [...dates].sort(), totals));
}

/**
 * Upsert a batch of sessions, then refresh the rollup of every local date it
 * touched. Returns those dates so the caller can ask for the affected scores to
 * be recomputed.
 */
export async function storeSleepSessions(userId: string, sessions: SleepSessionPoint[]): Promise<string[]> {
  const touched = await upsertSleepSessions(userId, sessions);
  if (touched.length === 0) return [];
  const timeZone = await timezoneOf(userId);
  const dates = [...new Set(touched.map((end) => localCivilDate(end, timeZone)))].sort();
  await recomputeSleepRollups(userId, dates);
  return dates;
}

export async function getBiometricsForUser(userId: string) {
  return prisma.biometricRecord.findMany({
    where: { userId },
    // Only what the dashboard actually renders; userId and syncedAt are
    // internal and need not be exposed to the client.
    select: { id: true, metricType: true, value: true, recordedAt: true },
    orderBy: { recordedAt: 'desc' },
  });
}
