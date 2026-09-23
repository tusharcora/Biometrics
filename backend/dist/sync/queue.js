"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEPS_HISTORY_BACKFILL_JOB = exports.TOKEN_REFRESH_SWEEP_INTERVAL_MS = exports.TOKEN_REFRESH_SWEEP_JOB = exports.syncQueue = exports.connection = void 0;
exports.enqueueFetchJob = enqueueFetchJob;
exports.enqueueBackfillJob = enqueueBackfillJob;
exports.enqueueStepsHistoryBackfill = enqueueStepsHistoryBackfill;
exports.scheduleTokenRefreshSweep = scheduleTokenRefreshSweep;
exports.enqueueImmediateTokenRefreshSweep = enqueueImmediateTokenRefreshSweep;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
exports.connection = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
exports.syncQueue = new bullmq_1.Queue('health-sync', { connection: exports.connection });
exports.TOKEN_REFRESH_SWEEP_JOB = 'tokenRefreshSweep';
exports.TOKEN_REFRESH_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
function enqueueFetchJob(data) {
    return exports.syncQueue.add('fetch', data);
}
function enqueueBackfillJob(data) {
    return exports.syncQueue.add('backfill', data);
}
exports.STEPS_HISTORY_BACKFILL_JOB = 'backfillStepsHistory';
/**
 * One job per user at a time: the job id dedupes a connect that races the
 * startup sweep. Removed on completion AND failure so the id is free again for
 * the next reconnect or server start (the job is idempotent either way).
 */
function enqueueStepsHistoryBackfill(userId) {
    return exports.syncQueue.add(exports.STEPS_HISTORY_BACKFILL_JOB, { userId }, {
        // BullMQ rejects a custom job id containing ':'.
        jobId: `${exports.STEPS_HISTORY_BACKFILL_JOB}-${userId}`,
        removeOnComplete: true,
        removeOnFail: true,
    });
}
/**
 * Schedules the token refresh sweep as a repeatable queue job rather than a
 * per-process setInterval. Without this, every backend instance would sweep
 * independently, sending redundant refresh calls to Google for the same
 * connections and fanning out avoidable rate-limited requests. BullMQ hands
 * each scheduled execution to exactly one worker across all processes.
 * Registration is idempotent: re-registering the same job id just updates
 * the existing schedule.
 */
function scheduleTokenRefreshSweep() {
    return exports.syncQueue.upsertJobScheduler(exports.TOKEN_REFRESH_SWEEP_JOB, { every: exports.TOKEN_REFRESH_SWEEP_INTERVAL_MS }, { name: exports.TOKEN_REFRESH_SWEEP_JOB });
}
/**
 * The repeatable schedule's first run is one full interval away, so kick off a
 * single sweep at startup too. Also deduplicated by job id, so N instances
 * booting together still produce one sweep.
 */
function enqueueImmediateTokenRefreshSweep() {
    return exports.syncQueue.add(exports.TOKEN_REFRESH_SWEEP_JOB, {}, 
    // BullMQ rejects a custom job id containing ':'.
    { jobId: `${exports.TOKEN_REFRESH_SWEEP_JOB}-startup`, removeOnComplete: true });
}
//# sourceMappingURL=queue.js.map