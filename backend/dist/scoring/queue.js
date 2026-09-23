"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_SWEEP_CRON = exports.SCORE_DEBOUNCE_MS = exports.SCORE_SWEEP_JOB = exports.COMPUTE_DAILY_SCORE_JOB = void 0;
exports.scoreJobId = scoreJobId;
exports.enqueueScoreCompute = enqueueScoreCompute;
exports.scheduleNightlyScoreSweep = scheduleNightlyScoreSweep;
const queue_1 = require("../sync/queue");
// Score jobs ride the existing 'health-sync' queue and its worker (job names
// dispatched in sync/worker.ts) rather than a second queue + worker + Redis
// connection: one process to run, and the same retry/backoff machinery. The
// queue is a parameter everywhere below so tests can hand in a fake instead of
// needing a live worker.
exports.COMPUTE_DAILY_SCORE_JOB = 'computeDailyScore';
exports.SCORE_SWEEP_JOB = 'scoreSweep';
/** A burst of overnight sleep + HRV + RHR webhooks collapses into one recompute. */
exports.SCORE_DEBOUNCE_MS = 5 * 60 * 1000;
/** 03:30 server time, nightly. A cron pattern (not `every`) so it stays at a fixed hour across restarts. */
exports.SCORE_SWEEP_CRON = '30 3 * * *';
/**
 * Deterministic per user+date. BullMQ ignores an add() whose jobId already
 * exists, which is what makes the debounce work: the second..Nth webhook in a
 * burst finds the delayed job already queued and is a no-op. (BullMQ rejects
 * ':' in a custom job id, hence the dashes.)
 */
function scoreJobId(userId, date) {
    return `score-${userId}-${date}`;
}
/**
 * Queue one recompute of (userId, date), debounced. The job is removed when it
 * finishes or fails: a retained job would keep its id occupied and silently
 * swallow every later enqueue for that day. Data arriving while the job is
 * running is picked up by the nightly sweep, the backstop for this window.
 */
function enqueueScoreCompute(userId, date, { queue = queue_1.syncQueue, delayMs = exports.SCORE_DEBOUNCE_MS } = {}) {
    const data = { userId, date };
    const opts = {
        jobId: scoreJobId(userId, date),
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    };
    return queue.add(exports.COMPUTE_DAILY_SCORE_JOB, data, opts);
}
/** Registers the nightly sweep as a repeatable scheduler (idempotent, one execution across all instances). */
function scheduleNightlyScoreSweep(queue = queue_1.syncQueue) {
    return queue.upsertJobScheduler(exports.SCORE_SWEEP_JOB, { pattern: exports.SCORE_SWEEP_CRON }, { name: exports.SCORE_SWEEP_JOB });
}
//# sourceMappingURL=queue.js.map