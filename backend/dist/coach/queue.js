"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COACH_RETENTION_CRON = exports.COACH_WEEKLY_DIGEST_CRON = exports.COACH_RETENTION_JOB = exports.COACH_WEEKLY_DIGEST_JOB = void 0;
exports.scheduleWeeklyCoachDigest = scheduleWeeklyCoachDigest;
exports.scheduleDailyCoachRetention = scheduleDailyCoachRetention;
const queue_1 = require("../sync/queue");
// Wired exactly like the nightly score sweep and the weekly habit sweep: the
// coach's scheduled jobs are repeatable schedulers on the existing
// 'health-sync' queue, dispatched in sync/worker.ts, and the queue is a
// parameter so tests hand in a fake instead of needing a live worker or Redis.
exports.COACH_WEEKLY_DIGEST_JOB = 'coachWeeklyDigest';
exports.COACH_RETENTION_JOB = 'coachRetentionSweep';
/**
 * Mondays 08:00 server time, after the Monday 05:00 habit correlation run so the
 * recap sees freshly confirmed patterns. One digest per user per local week is
 * enforced in the job itself, so a doubled or late tick is harmless.
 */
exports.COACH_WEEKLY_DIGEST_CRON = '0 8 * * 1';
/** 04:15 server time, daily. */
exports.COACH_RETENTION_CRON = '15 4 * * *';
/** Idempotent; BullMQ hands each tick to exactly one worker across all instances. */
function scheduleWeeklyCoachDigest(queue = queue_1.syncQueue) {
    return queue.upsertJobScheduler(exports.COACH_WEEKLY_DIGEST_JOB, { pattern: exports.COACH_WEEKLY_DIGEST_CRON }, { name: exports.COACH_WEEKLY_DIGEST_JOB });
}
function scheduleDailyCoachRetention(queue = queue_1.syncQueue) {
    return queue.upsertJobScheduler(exports.COACH_RETENTION_JOB, { pattern: exports.COACH_RETENTION_CRON }, { name: exports.COACH_RETENTION_JOB });
}
//# sourceMappingURL=queue.js.map