"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHabitCorrelationSweep = runHabitCorrelationSweep;
const client_1 = require("../db/client");
const queue_1 = require("../sync/queue");
const job_1 = require("./job");
const queue_2 = require("./queue");
/**
 * The weekly fan-out: one runHabitCorrelations job per user who has ever
 * logged a habit or checked in, or who still has a stored correlation row (a
 * user who stopped logging must still have their rows age toward RETIRED
 * rather than stay CONFIRMED forever). Per-user jobs, not one big loop, so one
 * user's failure retries alone.
 */
async function runHabitCorrelationSweep({ queue = queue_1.syncQueue, now = new Date(), } = {}) {
    const [logged, checkedIn, withRows] = await Promise.all([
        client_1.prisma.habitLog.findMany({ distinct: ['userId'], select: { userId: true } }),
        client_1.prisma.habitCheckIn.findMany({ distinct: ['userId'], select: { userId: true } }),
        client_1.prisma.habitCorrelation.findMany({ distinct: ['userId'], select: { userId: true } }),
    ]);
    const userIds = new Set([...logged, ...checkedIn, ...withRows].map((r) => r.userId));
    const runKey = (0, job_1.isoWeekKey)(now);
    for (const userId of userIds)
        await (0, queue_2.enqueueHabitCorrelations)(userId, runKey, { queue });
    return { usersEnqueued: userIds.size };
}
//# sourceMappingURL=sweep.js.map