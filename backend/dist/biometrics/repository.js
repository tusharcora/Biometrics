"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertBiometricRecords = upsertBiometricRecords;
exports.upsertSleepSessions = upsertSleepSessions;
exports.recomputeSleepRollups = recomputeSleepRollups;
exports.recomputeAllSleepRollups = recomputeAllSleepRollups;
exports.storeSleepSessions = storeSleepSessions;
exports.datesNeedingRescore = datesNeedingRescore;
exports.getBiometricsForUser = getBiometricsForUser;
const dates_1 = require("../scoring/dates");
const configs_1 = require("../scoring/configs");
const client_1 = require("../db/client");
const civilDate_1 = require("./civilDate");
const DAY_MS = 24 * 60 * 60 * 1000;
async function upsertBiometricRecords(userId, metricType, points) {
    for (const point of points) {
        await client_1.prisma.biometricRecord.upsert({
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
 * to the latest values, including its UTC offsets (so re-fetching a row stored
 * before the offsets were captured fills them in). (Summing into a per-day row
 * instead would double-count on every repeat webhook, retried job and re-run
 * backfill.)
 *
 * Returns the ends this call touched -- the new end of every session AND the
 * previous end of any session whose end moved -- each with the offset it was
 * keyed under, so the caller can recompute every rollup date that may have
 * changed, including the one a revised (or newly offset-keyed) session just left.
 */
async function upsertSleepSessionsTouched(userId, sessions) {
    if (sessions.length === 0)
        return [];
    // Last one wins if a batch repeats a startTime, matching what sequential
    // overwrite-upserts would leave behind.
    const byStart = new Map();
    for (const s of sessions)
        byStart.set(s.startTime.getTime(), s);
    const unique = [...byStart.values()];
    const existing = await client_1.prisma.sleepSession.findMany({
        where: { userId, startTime: { in: unique.map((s) => s.startTime) } },
        select: { endTime: true, endUtcOffsetSeconds: true },
    });
    await client_1.prisma.$transaction(unique.map((s) => {
        // `?? null`: a missing offset is stored as null (converge to the latest fetch), never left stale.
        const offsets = {
            startUtcOffsetSeconds: s.startUtcOffsetSeconds ?? null,
            endUtcOffsetSeconds: s.endUtcOffsetSeconds ?? null,
        };
        return client_1.prisma.sleepSession.upsert({
            where: { userId_startTime: { userId, startTime: s.startTime } },
            update: { endTime: s.endTime, minutesAsleep: s.minutesAsleep, ...offsets, syncedAt: new Date() },
            create: { userId, startTime: s.startTime, endTime: s.endTime, minutesAsleep: s.minutesAsleep, ...offsets },
        });
    }));
    return [
        ...unique.map((s) => ({ endTime: s.endTime, endUtcOffsetSeconds: s.endUtcOffsetSeconds ?? null })),
        ...existing,
    ];
}
/** As upsertSleepSessionsTouched, returning only the end instants. */
async function upsertSleepSessions(userId, sessions) {
    return (await upsertSleepSessionsTouched(userId, sessions)).map((t) => t.endTime);
}
async function timezoneOf(userId) {
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    if (!user)
        throw new Error(`Cannot compute sleep rollups: user ${userId} not found`);
    return user.timezone;
}
// Sum of minutesAsleep per local civil date of each session's end instant: the
// record's own end offset when it has one, else the user's timezone.
function totalsByLocalDate(sessions, timeZone) {
    const totals = new Map();
    for (const s of sessions) {
        const date = (0, civilDate_1.sessionEndCivilDate)(s, timeZone);
        totals.set(date, (totals.get(date) ?? 0) + s.minutesAsleep);
    }
    return totals;
}
function rollupWrites(client, userId, dates, totals) {
    return dates.map((date) => {
        const recordedAt = (0, civilDate_1.civilDateToUtcMidnight)(date);
        const total = totals.get(date);
        if (total === undefined) {
            return client.biometricRecord.deleteMany({ where: { userId, metricType: 'SLEEP', recordedAt } });
        }
        return client.biometricRecord.upsert({
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
async function recomputeSleepRollups(userId, civilDates) {
    const dates = [...new Set(civilDates)].sort();
    if (dates.length === 0)
        return;
    const timeZone = await timezoneOf(userId);
    // A local civil date spans at most [D 00:00 - 14h, D+1 00:00 + 12h) in UTC
    // across every real zone or record offset, so [D - 1d, D + 2d) always
    // contains its sessions. The exact bucketing is then done per-session.
    const from = new Date((0, civilDate_1.civilDateToUtcMidnight)(dates[0]).getTime() - DAY_MS);
    const to = new Date((0, civilDate_1.civilDateToUtcMidnight)(dates[dates.length - 1]).getTime() + 2 * DAY_MS);
    // The read has to sit inside the same transaction as the write, and be
    // serialised against other jobs for this user. Two sync jobs used to read
    // their own snapshot of the sessions, compute a total from it, and then both
    // write -- so whichever committed last could persist a total that omitted
    // the other's sessions. A per-user advisory lock (rather than SERIALIZABLE)
    // keeps that ordering without making unrelated users retry each other.
    await client_1.prisma.$transaction(async (tx) => {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const sessions = await tx.sleepSession.findMany({
            where: { userId, endTime: { gte: from, lt: to } },
            select: { endTime: true, endUtcOffsetSeconds: true, minutesAsleep: true },
        });
        for (const write of rollupWrites(tx, userId, dates, totalsByLocalDate(sessions, timeZone))) {
            await write;
        }
    });
}
/**
 * Rebuilds every SLEEP rollup for a user from scratch under their current
 * timezone. Used when the timezone changes: rollups keyed under the old zone
 * are dropped and the sessions re-bucketed, which is cheap because rollups
 * are derived. Sessions that carry their own UTC offset are keyed by it, so
 * they do not move with the timezone.
 */
async function recomputeAllSleepRollups(userId) {
    const timeZone = await timezoneOf(userId);
    const touchedDates = [];
    await client_1.prisma.$transaction(async (tx) => {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const sessions = await tx.sleepSession.findMany({
            where: { userId },
            select: { endTime: true, endUtcOffsetSeconds: true, minutesAsleep: true },
        });
        const totals = totalsByLocalDate(sessions, timeZone);
        const existing = await tx.biometricRecord.findMany({
            where: { userId, metricType: 'SLEEP' },
            select: { recordedAt: true },
        });
        const dates = new Set(totals.keys());
        for (const r of existing)
            dates.add(r.recordedAt.toISOString().slice(0, 10));
        const sorted = [...dates].sort();
        touchedDates.push(...sorted);
        for (const write of rollupWrites(tx, userId, sorted, totals)) {
            await write;
        }
    });
    // Every SLEEP rollup was just re-keyed under the new zone, so every score
    // built on one is stale. The nightly sweep would eventually notice (the
    // rewrites bump syncedAt), but "eventually" here means the user sees scores
    // from their old day boundaries until tomorrow.
    return touchedDates;
}
/**
 * Upsert a batch of sessions, then refresh the rollup of every local date it
 * touched. Returns those dates so the caller can ask for the affected scores to
 * be recomputed.
 */
async function storeSleepSessions(userId, sessions) {
    const touched = await upsertSleepSessionsTouched(userId, sessions);
    if (touched.length === 0)
        return [];
    const timeZone = await timezoneOf(userId);
    const dates = [...new Set(touched.map((end) => (0, civilDate_1.sessionEndCivilDate)(end, timeZone)))].sort();
    await recomputeSleepRollups(userId, dates);
    return dates;
}
/**
 * The days whose scores a set of changed sleep nights invalidates.
 *
 * A night is not only an input to its own day: sleepDebtRolling sums the
 * deficit over a trailing window, so night D is still inside the window of
 * every day up to D + windowDays - 1. Returning only the touched dates meant a
 * late webhook, a reconnect backfill or a night Google revised re-scored day D
 * alone and left the following two weeks computed from a window that no longer
 * matched the data. The nightly sweep does not catch it either: its staleness
 * test is per day, and those days' own inputs never changed.
 *
 * Nothing is emitted past today -- there is no score to recompute for a day
 * that has not happened.
 */
function datesNeedingRescore(touchedDates, today = isoDateOf(new Date())) {
    const windowDays = (0, configs_1.getLiveConfig)().sleepDebtWindowDays;
    const out = new Set();
    for (const date of touchedDates) {
        for (let i = 0; i < windowDays; i++) {
            const d = (0, dates_1.shiftDate)(date, i);
            if (d > today)
                break;
            out.add(d);
        }
    }
    return [...out].sort();
}
function isoDateOf(d) {
    return d.toISOString().slice(0, 10);
}
async function getBiometricsForUser(userId) {
    return client_1.prisma.biometricRecord.findMany({
        where: { userId },
        // Only what the dashboard actually renders; userId and syncedAt are
        // internal and need not be exposed to the client.
        select: { id: true, metricType: true, value: true, recordedAt: true },
        orderBy: { recordedAt: 'desc' },
    });
}
//# sourceMappingURL=repository.js.map