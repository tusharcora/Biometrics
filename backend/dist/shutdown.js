"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SHUTDOWN_TIMEOUT_MS = void 0;
exports.shutdown = shutdown;
exports.installShutdownHandlers = installShutdownHandlers;
exports.DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;
function closeServer(server) {
    // A close error is not actionable here -- the process is going away either
    // way -- so the callback's argument is deliberately ignored.
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}
async function drain(deps, log) {
    await closeServer(deps.server);
    log('HTTP server closed; draining the sync worker');
    await deps.worker.close();
    await deps.queue.close();
    await deps.redis.quit();
    await deps.prisma.$disconnect();
}
/** Runs the drain, bounded by `timeoutMs`. Resolves to the exit code to use. */
async function shutdown(deps) {
    const log = deps.log ?? ((m) => console.log(m));
    const timeoutMs = deps.timeoutMs ?? exports.DEFAULT_SHUTDOWN_TIMEOUT_MS;
    let timer;
    const timedOut = new Promise((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
        // The timer must never be the reason the process stays alive.
        timer.unref?.();
    });
    try {
        const outcome = await Promise.race([drain(deps, log).then(() => 'done'), timedOut]);
        if (outcome === 'timeout') {
            log(`Shutdown still draining after ${timeoutMs}ms; exiting anyway`);
            return 1;
        }
        log('Shutdown complete');
        return 0;
    }
    catch (err) {
        log(`Shutdown failed: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
/**
 * Registers SIGTERM/SIGINT. A second signal while a drain is already running is
 * ignored rather than starting a second one: an impatient double Ctrl-C would
 * otherwise interrupt the very drain it was waiting for.
 */
function installShutdownHandlers(deps) {
    const exit = deps.exit ?? ((code) => process.exit(code));
    const log = deps.log ?? ((m) => console.log(m));
    let running = false;
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => {
            if (running) {
                log(`Received ${signal} again; already shutting down`);
                return;
            }
            running = true;
            log(`Received ${signal}; shutting down gracefully`);
            void shutdown(deps).then(exit);
        });
    }
}
//# sourceMappingURL=shutdown.js.map