"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEPS_HISTORY_DAYS = void 0;
exports.stepsHistoryWindow = stepsHistoryWindow;
exports.enqueuePendingStepsHistoryBackfills = enqueuePendingStepsHistoryBackfills;
const client_1 = require("../db/client");
const queue_1 = require("./queue");
// How far back the activity heat map's steps history reaches. Deliberately
// separate from the connect-time BACKFILL_WINDOW_DAYS (30, all four metrics):
// widening that would change the inputs to baselines and scores.
exports.STEPS_HISTORY_DAYS = 365;
/** The half-open [start, end) window of the steps history, ending at (excluding) `today`. */
function stepsHistoryWindow(today = new Date()) {
    const end = today.toISOString().slice(0, 10);
    const start = new Date(`${end}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - exports.STEPS_HISTORY_DAYS);
    return { startDate: start.toISOString().slice(0, 10), endDate: end };
}
/**
 * Enqueues the steps history backfill for every connected user it has not yet
 * succeeded for. Runs once at server start, so users who connected before the
 * heat map existed get their history without reconnecting. Returns how many
 * were enqueued.
 */
async function enqueuePendingStepsHistoryBackfills() {
    const pending = await client_1.prisma.healthConnection.findMany({
        where: { status: 'CONNECTED', stepsHistoryBackfilledAt: null },
        select: { userId: true },
    });
    for (const { userId } of pending) {
        await (0, queue_1.enqueueStepsHistoryBackfill)(userId);
    }
    return pending.length;
}
//# sourceMappingURL=stepsHistory.js.map