"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HABIT_CORRELATION_CRON = exports.RUN_HABIT_CORRELATIONS_JOB = exports.HABIT_CORRELATION_SWEEP_JOB = void 0;
exports.habitCorrelationJobId = habitCorrelationJobId;
exports.enqueueHabitCorrelations = enqueueHabitCorrelations;
exports.scheduleWeeklyHabitCorrelationSweep = scheduleWeeklyHabitCorrelationSweep;
const queue_1 = require("../sync/queue");
// Wired exactly like the nightly score sweep (scoring/queue.ts): the jobs ride
// the existing 'health-sync' queue and worker, and the queue is a parameter so
// tests can hand in a fake instead of needing a live worker.
exports.HABIT_CORRELATION_SWEEP_JOB = 'habitCorrelationSweep';
exports.RUN_HABIT_CORRELATIONS_JOB = 'runHabitCorrelations';
/** Mondays 05:00 server time. Weekly on purpose: a week is the smallest amount of new data worth re-testing (nightly would be noise chasing noise). */
exports.HABIT_CORRELATION_CRON = '0 5 * * 1';
/** Deterministic per user+week: BullMQ ignores an add() whose id already exists. (No ':' in a BullMQ custom id.) */
function habitCorrelationJobId(userId, runKey) {
    return `habit-corr-${userId}-${runKey}`;
}
function enqueueHabitCorrelations(userId, runKey, { queue = queue_1.syncQueue } = {}) {
    const data = { userId, runKey };
    const opts = {
        jobId: habitCorrelationJobId(userId, runKey),
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    };
    return queue.add(exports.RUN_HABIT_CORRELATIONS_JOB, data, opts);
}
/** Registers the weekly sweep as a repeatable scheduler (idempotent, one execution across all instances). */
function scheduleWeeklyHabitCorrelationSweep(queue = queue_1.syncQueue) {
    return queue.upsertJobScheduler(exports.HABIT_CORRELATION_SWEEP_JOB, { pattern: exports.HABIT_CORRELATION_CRON }, { name: exports.HABIT_CORRELATION_SWEEP_JOB });
}
//# sourceMappingURL=queue.js.map