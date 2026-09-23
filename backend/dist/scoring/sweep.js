"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SWEEP_LOOKBACK_DAYS = void 0;
exports.runScoreSweep = runScoreSweep;
const client_1 = require("../db/client");
const civilDate_1 = require("../biometrics/civilDate");
const dates_1 = require("./dates");
const configs_1 = require("./configs");
const queue_1 = require("./queue");
const queue_2 = require("../sync/queue");
/** How far back the sweep back-fills missing scores. */
exports.SWEEP_LOOKBACK_DAYS = 90;
const SCORE_INPUT_METRICS = ['HRV', 'RESTING_HR', 'SLEEP'];
/**
 * The correctness backstop behind the debounced per-webhook trigger: finds every
 * (user, date) in the lookback window that has score inputs but either no
 * score (a missed debounce, a first run, a day back-filled after the fact) or a
 * score older than the newest input's syncedAt, and enqueues the same single
 * computeDailyScore job for it. Delay 0: the sweep is already the slow path,
 * and the deterministic job id still collapses it into a job the webhook path
 * queued a moment earlier.
 *
 * Both score types are covered by that one job, so a day is enqueued when
 * EITHER is missing or stale (stale includes "scored by a version other than
 * LIVE_VERSION", so flipping the live version re-scores every day in the
 * lookback window over the following sweeps):
 *  - RECOVERY is expected for any day with an HRV, RESTING_HR or SLEEP input;
 *  - SLEEP is expected only for a day with a SLEEP input (a day with just HRV
 *    never gets a Sleep Score, so it must not be re-enqueued forever for
 *    lacking one). Its input is the SLEEP rollup, whose syncedAt is bumped on
 *    every session upsert.
 */
async function runScoreSweep({ queue = queue_2.syncQueue, now = new Date(), lookbackDays = exports.SWEEP_LOOKBACK_DAYS, } = {}) {
    const today = now.toISOString().slice(0, 10);
    const since = (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(today, -lookbackDays));
    // Newest sync time per (user, date, metric) across the score-input metrics.
    const inputs = await client_1.prisma.biometricRecord.groupBy({
        by: ['userId', 'recordedAt', 'metricType'],
        where: { metricType: { in: [...SCORE_INPUT_METRICS] }, recordedAt: { gte: since } },
        _max: { syncedAt: true },
    });
    if (inputs.length === 0)
        return { usersChecked: 0, jobsEnqueued: 0 };
    // Fold to one entry per (user, date).
    const days = new Map();
    for (const input of inputs) {
        const date = input.recordedAt.toISOString().slice(0, 10);
        const key = `${input.userId}|${date}`;
        const day = days.get(key) ?? { userId: input.userId, date, newest: null, newestSleep: null, hasSleep: false };
        const synced = input._max.syncedAt;
        if (synced !== null && (day.newest === null || synced > day.newest))
            day.newest = synced;
        if (input.metricType === 'SLEEP') {
            day.hasSleep = true;
            if (synced !== null && (day.newestSleep === null || synced > day.newestSleep))
                day.newestSleep = synced;
        }
        days.set(key, day);
    }
    const userIds = [...new Set([...days.values()].map((d) => d.userId))];
    const scores = await client_1.prisma.dailyScore.findMany({
        where: { userId: { in: userIds }, date: { gte: since } },
        select: { userId: true, date: true, type: true, updatedAt: true, algorithmVersion: true },
    });
    const scored = new Map(scores.map((s) => [
        `${s.userId}|${s.date.toISOString().slice(0, 10)}|${s.type}`,
        { updatedAt: s.updatedAt, algorithmVersion: s.algorithmVersion },
    ]));
    // Stale = missing, older than its newest input, or written by a different
    // algorithm version than the live one (a version flip re-scores history: the
    // stored row is the OLD algorithm's answer however fresh its timestamp).
    const isStale = (last, newestInput) => last === undefined ||
        last.algorithmVersion !== configs_1.LIVE_VERSION ||
        (newestInput !== null && newestInput > last.updatedAt);
    let jobsEnqueued = 0;
    for (const day of days.values()) {
        const key = `${day.userId}|${day.date}`;
        const stale = isStale(scored.get(`${key}|RECOVERY`), day.newest) ||
            (day.hasSleep && isStale(scored.get(`${key}|SLEEP`), day.newestSleep));
        if (!stale)
            continue;
        await (0, queue_1.enqueueScoreCompute)(day.userId, day.date, { queue, delayMs: 0 });
        jobsEnqueued++;
    }
    return { usersChecked: userIds.length, jobsEnqueued };
}
//# sourceMappingURL=sweep.js.map