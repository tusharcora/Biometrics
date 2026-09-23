"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSyncJob = processSyncJob;
exports.startSyncWorker = startSyncWorker;
const bullmq_1 = require("bullmq");
const client_1 = require("../db/client");
const queue_1 = require("./queue");
const tokenRefreshJob_1 = require("./tokenRefreshJob");
const client_2 = require("../health/client");
const oauth_1 = require("../health/oauth");
const subscriber_1 = require("../health/subscriber");
const tokenCipher_1 = require("../crypto/tokenCipher");
const repository_1 = require("../biometrics/repository");
const queue_2 = require("./queue");
const window_1 = require("./window");
const stepsHistory_1 = require("./stepsHistory");
const tokenUpdate_1 = require("./tokenUpdate");
const compute_1 = require("../scoring/compute");
const sweep_1 = require("../scoring/sweep");
const queue_3 = require("../scoring/queue");
const job_1 = require("../habits/job");
const sweep_2 = require("../habits/sweep");
const queue_4 = require("../habits/queue");
const config_1 = require("../coach/config");
const digest_1 = require("../coach/digest");
const queue_5 = require("../coach/queue");
const retention_1 = require("../coach/retention");
const telemetry_1 = require("../coach/telemetry");
const ALL_METRIC_TYPES = ['HRV', 'RESTING_HR', 'SLEEP', 'STEPS'];
const SYNC_WORKER_CONCURRENCY = 5;
function isUnauthorized(err) {
    return err?.status === 401;
}
// YYYY-MM-DD -> the following calendar day, also YYYY-MM-DD (UTC arithmetic,
// so month/year rollovers are handled by Date).
function nextDay(isoDate) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid job date "${isoDate}": expected YYYY-MM-DD`);
    }
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}
function shiftDay(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid job date "${isoDate}": expected YYYY-MM-DD`);
    }
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
// SLEEP's day key is a local civil date but the fetch filter is on UTC
// instants, so a window covering exactly [start, end) can miss sessions that
// belong to its edge days. Widen by one day each side: for a single-day job
// [D, D+1) this is the spec's [D-1, D+2). Sessions are idempotent, so the
// overlap costs nothing; a session that is still missed is simply absent
// until a later window includes it, and the rollup converges then.
function sleepWindow(startDate, endDate) {
    return [shiftDay(startDate, -1), shiftDay(endDate, 1)];
}
async function disconnect(userId, webhookSubscriptionId) {
    await client_1.prisma.healthConnection.update({
        where: { userId },
        data: { status: 'DISCONNECTED' },
    });
    if (webhookSubscriptionId) {
        try {
            await (0, subscriber_1.deleteUserSubscription)(webhookSubscriptionId);
        }
        catch (err) {
            console.error(`Failed to delete Google Health subscription ${webhookSubscriptionId}`, err);
        }
    }
}
/**
 * Per-job access-token state. A 401 from Google can mean the grant was
 * revoked, but it can equally mean the access token merely expired between
 * the last refresh sweep and this job running (sweep lag, clock skew, a job
 * that sat in the queue). Tearing down the connection and its Google
 * subscription on the first 401 would destroy real state for a transient
 * condition, so each job gets exactly ONE in-line refresh attempt before a
 * 401 is treated as terminal.
 */
class JobTokenSession {
    conn;
    accessToken;
    refreshed = false;
    constructor(conn) {
        this.conn = conn;
        this.accessToken = (0, tokenCipher_1.decryptToken)(conn.encryptedAccessToken);
    }
    async fetch(metricType, startDate, endDate) {
        return this.withRefresh((token) => (0, client_2.fetchMetricRange)(token, metricType, startDate, endDate));
    }
    async fetchSleep(startDate, endDate) {
        return this.withRefresh((token) => (0, client_2.fetchSleepSessions)(token, startDate, endDate));
    }
    async withRefresh(call) {
        try {
            return await call(this.accessToken);
        }
        catch (err) {
            if (!isUnauthorized(err) || this.refreshed)
                throw err;
            // One refresh per job. If the refresh itself fails, surface the ORIGINAL
            // 401 so the caller's disconnect path runs exactly as before.
            this.refreshed = true;
            let tokens;
            try {
                tokens = await (0, oauth_1.refreshHealthTokens)((0, tokenCipher_1.decryptToken)(this.conn.encryptedRefreshToken));
            }
            catch (refreshErr) {
                console.error(`In-line Google Health token refresh failed for user ${this.conn.userId}`, refreshErr);
                throw err;
            }
            // Persist before retrying so a successful refresh is never lost even if
            // the retry fails for an unrelated reason. A DB failure here is a
            // transient infrastructure problem, not a revoked grant: it propagates
            // as a non-401 error and BullMQ retries the job.
            await client_1.prisma.healthConnection.update({
                where: { id: this.conn.id },
                data: (0, tokenUpdate_1.refreshedTokenUpdateData)(tokens),
            });
            this.accessToken = tokens.accessToken;
            // A second 401 with a freshly minted token means access really is gone;
            // let it propagate to the disconnect path.
            return await call(this.accessToken);
        }
    }
}
// SLEEP is stored as whole sessions (idempotent upsert) and the BiometricRecord
// row is a rollup re-derived for every touched local date -- see
// biometrics/repository.ts for why summing per-day rows was rejected.
async function syncSleep(session, userId, startDate, endDate) {
    const [from, to] = sleepWindow(startDate, endDate);
    const touched = await (0, repository_1.storeSleepSessions)(userId, await session.fetchSleep(from, to));
    // A night is an input to its own day AND to every later day whose sleep-debt
    // window still contains it, so a night that arrives late (a delayed webhook,
    // a reconnect backfill, a night Google revised) invalidates the fortnight
    // after it too. The nightly sweep will not catch those days: its staleness
    // test is per day, and their own inputs never changed.
    return (0, repository_1.datesNeedingRescore)(touched);
}
// HRV, RHR and SLEEP feed the Recovery Score (SLEEP also feeds the Sleep Score);
// STEPS does not (its only derived feature, ACWR, is stored but excluded from the composite).
const SCORE_INPUT_METRICS = new Set(['HRV', 'RESTING_HR', 'SLEEP']);
/**
 * Asks for the affected days' scores to be recomputed, debounced per user+day
 * so a burst of overnight sleep + HRV + RHR webhooks becomes one recompute.
 * Scoring is derived data: a failure to enqueue must never fail (and so
 * retry) a sync job whose data is already safely stored. The nightly sweep is
 * the backstop for anything missed here.
 */
async function requestScores(userId, dates) {
    for (const date of new Set(dates)) {
        try {
            await (0, queue_3.enqueueScoreCompute)(userId, date);
        }
        catch (err) {
            console.error(`Failed to enqueue score recompute for user ${userId} on ${date}`, err);
        }
    }
}
const civilDateOf = (p) => p.recordedAt.toISOString().slice(0, 10);
async function handleFetchJob(data) {
    const conn = await client_1.prisma.healthConnection.findUnique({ where: { userId: data.userId } });
    if (!conn || conn.status === 'DISCONNECTED')
        return;
    try {
        const session = new JobTokenSession(conn);
        // fetchMetricRange's ranges are half-open (start inclusive, end exclusive):
        // dataPoints.list filters on `>= start AND < end`, and dailyRollUp's
        // confirmed-live usage retrieves the `start` bucket with end = start + 1.
        // Passing the same date for both bounds is an empty range, so a
        // single-day job must ask for [date, date + 1).
        const end = nextDay(data.date);
        if (data.metricType === 'SLEEP') {
            await requestScores(data.userId, await syncSleep(session, data.userId, data.date, end));
        }
        else {
            const points = await session.fetch(data.metricType, data.date, end);
            await (0, repository_1.upsertBiometricRecords)(data.userId, data.metricType, points);
            if (SCORE_INPUT_METRICS.has(data.metricType))
                await requestScores(data.userId, points.map(civilDateOf));
        }
        await client_1.prisma.healthConnection.update({
            where: { userId: data.userId },
            data: { lastSyncedAt: new Date() },
        });
    }
    catch (err) {
        if (isUnauthorized(err)) {
            await disconnect(data.userId, conn.webhookSubscriptionId);
            return;
        }
        throw err; // other errors (e.g. 429) are retried by BullMQ's job retry policy
    }
}
async function handleBackfillJob(data) {
    // Nothing to fetch, and Google answers an empty window with a 400 that would
    // fail the job (e.g. a reconnect on the same day as the last sync). Not a
    // sync, so lastSyncedAt is deliberately left alone.
    if ((0, window_1.isEmptyWindow)(data.startDate, data.endDate))
        return;
    const conn = await client_1.prisma.healthConnection.findUnique({ where: { userId: data.userId } });
    if (!conn || conn.status === 'DISCONNECTED')
        return;
    try {
        const session = new JobTokenSession(conn);
        const scoreDates = [];
        for (const metricType of ALL_METRIC_TYPES) {
            if (metricType === 'SLEEP') {
                scoreDates.push(...(await syncSleep(session, data.userId, data.startDate, data.endDate)));
                continue;
            }
            const points = await session.fetch(metricType, data.startDate, data.endDate);
            await (0, repository_1.upsertBiometricRecords)(data.userId, metricType, points);
            if (SCORE_INPUT_METRICS.has(metricType))
                scoreDates.push(...points.map(civilDateOf));
        }
        await requestScores(data.userId, scoreDates);
        await client_1.prisma.healthConnection.update({ where: { userId: data.userId }, data: { lastSyncedAt: new Date() } });
    }
    catch (err) {
        if (isUnauthorized(err)) {
            await disconnect(data.userId, conn.webhookSubscriptionId);
            return;
        }
        throw err; // other errors (e.g. 429) are retried by BullMQ's job retry policy
    }
}
/**
 * A year of daily STEPS for the activity heat map, and nothing else. Separate
 * from handleBackfillJob so the scoring inputs (a 30-day backfill of all four
 * metrics) are unchanged. STEPS is not a score input, so no scores are
 * requested, and lastSyncedAt is left alone: this is history, not a sync.
 */
async function handleStepsHistoryJob(data) {
    const conn = await client_1.prisma.healthConnection.findUnique({ where: { userId: data.userId } });
    if (!conn || conn.status === 'DISCONNECTED')
        return;
    const { startDate, endDate } = (0, stepsHistory_1.stepsHistoryWindow)();
    try {
        if (!(0, window_1.isEmptyWindow)(startDate, endDate)) {
            // fetchMetricRange chunks the year into windows Google accepts.
            const points = await new JobTokenSession(conn).fetch('STEPS', startDate, endDate);
            await (0, repository_1.upsertBiometricRecords)(data.userId, 'STEPS', points);
        }
        await client_1.prisma.healthConnection.update({
            where: { userId: data.userId },
            data: { stepsHistoryBackfilledAt: new Date() },
        });
    }
    catch (err) {
        if (isUnauthorized(err)) {
            await disconnect(data.userId, conn.webhookSubscriptionId);
            return;
        }
        throw err; // other errors (e.g. 429) are retried by BullMQ's job retry policy
    }
}
async function processSyncJob(job) {
    if (job.name === 'fetch') {
        await handleFetchJob(job.data);
    }
    else if (job.name === 'backfill') {
        await handleBackfillJob(job.data);
    }
    else if (job.name === queue_2.STEPS_HISTORY_BACKFILL_JOB) {
        await handleStepsHistoryJob(job.data);
    }
    else if (job.name === queue_1.TOKEN_REFRESH_SWEEP_JOB) {
        // Scheduled through the queue so exactly one instance sweeps per tick.
        await (0, tokenRefreshJob_1.runTokenRefreshSweep)();
    }
    else if (job.name === queue_3.COMPUTE_DAILY_SCORE_JOB) {
        const { userId, date } = job.data;
        await (0, compute_1.computeDailyScore)(userId, date);
    }
    else if (job.name === queue_3.SCORE_SWEEP_JOB) {
        await (0, sweep_1.runScoreSweep)();
    }
    else if (job.name === queue_4.HABIT_CORRELATION_SWEEP_JOB) {
        await (0, sweep_2.runHabitCorrelationSweep)();
    }
    else if (job.name === queue_4.RUN_HABIT_CORRELATIONS_JOB) {
        const { userId, runKey } = job.data;
        await (0, job_1.runHabitCorrelations)(userId, { runKey });
    }
    else if (job.name === queue_5.COACH_WEEKLY_DIGEST_JOB) {
        // A no-op unless COACH_ENABLED; the provider and push sender are the configured slots.
        await (0, digest_1.runWeeklyDigest)({
            provider: (0, config_1.getCoachProvider)(),
            pushSender: (0, config_1.getPushSender)(),
            telemetry: new telemetry_1.LoggerCoachTelemetry(),
        });
    }
    else if (job.name === queue_5.COACH_RETENTION_JOB) {
        // Not gated on COACH_ENABLED: expiry must keep running if the coach is switched off.
        await (0, retention_1.runCoachRetention)({ telemetry: new telemetry_1.LoggerCoachTelemetry() });
    }
}
function startSyncWorker() {
    return new bullmq_1.Worker('health-sync', processSyncJob, {
        connection: queue_1.connection,
        concurrency: SYNC_WORKER_CONCURRENCY,
    });
}
//# sourceMappingURL=worker.js.map