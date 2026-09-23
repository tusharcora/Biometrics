"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const listen_1 = require("./listen");
const worker_1 = require("./sync/worker");
const queue_1 = require("./sync/queue");
const client_1 = require("./db/client");
const shutdown_1 = require("./shutdown");
const queue_2 = require("./scoring/queue");
const stepsHistory_1 = require("./sync/stepsHistory");
const queue_3 = require("./habits/queue");
const queue_4 = require("./coach/queue");
const port = Number(process.env.PORT ?? 3000);
// Queue workers and schedulers start only once the port is really bound. If
// another backend already owns it, this process must exit rather than run a
// second worker against the same queues while serving nothing (see listen.ts).
const server = (0, listen_1.listenOrExit)((0, app_1.createApp)(), port, {
    onListening: () => {
        console.log(`Backend listening on port ${port}`);
        startBackgroundWork();
    },
});
function startBackgroundWork() {
    const worker = (0, worker_1.startSyncWorker)();
    // Registered only once the port is bound and the worker exists, so a process
    // that exited because the port was taken never drains another one's queues.
    (0, shutdown_1.installShutdownHandlers)({ server, worker, queue: queue_1.syncQueue, redis: queue_1.connection, prisma: client_1.prisma });
    // The sweep runs as a repeatable queue job, not a per-process setInterval, so
    // that running more than one backend instance does not have several of them
    // racing to refresh the same single-use Google Health refresh token.
    (0, queue_1.scheduleTokenRefreshSweep)().catch((err) => console.error('Failed to schedule the token refresh sweep', err));
    (0, queue_1.enqueueImmediateTokenRefreshSweep)().catch((err) => console.error('Failed to enqueue the startup token refresh sweep', err));
    // Nightly backstop for the debounced per-webhook score recompute: catches
    // missed debounce windows and back-fills days with data but no score.
    (0, queue_2.scheduleNightlyScoreSweep)().catch((err) => console.error('Failed to schedule the nightly score sweep', err));
    // Weekly habit/biometric correlation run. Weekly, not nightly: a pattern needs
    // new data between runs to be worth re-testing.
    (0, queue_3.scheduleWeeklyHabitCorrelationSweep)().catch((err) => console.error('Failed to schedule the weekly habit correlation sweep', err));
    // Coach weekly digest (a no-op at run time unless COACH_ENABLED) and the daily
    // 90-day transcript retention job (runs regardless of the flag).
    (0, queue_4.scheduleWeeklyCoachDigest)().catch((err) => console.error('Failed to schedule the weekly coach digest', err));
    (0, queue_4.scheduleDailyCoachRetention)().catch((err) => console.error('Failed to schedule the daily coach retention job', err));
    // A year of steps history for the activity heat map, for every connection
    // that does not have it yet (including ones made before it existed).
    (0, stepsHistory_1.enqueuePendingStepsHistoryBackfills)().catch((err) => console.error('Failed to enqueue pending steps history backfills', err));
}
//# sourceMappingURL=server.js.map