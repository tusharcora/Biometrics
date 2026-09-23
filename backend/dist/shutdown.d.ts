/**
 * Graceful shutdown for SIGTERM/SIGINT.
 *
 * Without this a deploy or a Ctrl-C killed the process mid-flight: in-progress
 * HTTP requests were cut off, and a sync job that had already fetched from
 * Google but not yet written its rows was abandoned rather than finished.
 *
 * Order matters. The HTTP server closes first so new requests stop arriving
 * while existing ones drain. The worker closes second: `worker.close()` waits
 * for the job it is running rather than dropping it. The queue, Redis
 * connection and Prisma pool close last, because the worker needs all three
 * while it drains.
 *
 * Everything is bounded by `timeoutMs`: a request that never ends, or a job
 * wedged on a slow Google call, must not hold a deploy open forever.
 */
export interface ShutdownDeps {
    server: {
        close(cb: (err?: Error) => void): unknown;
    };
    worker: {
        close(): Promise<void>;
    };
    queue: {
        close(): Promise<void>;
    };
    redis: {
        quit(): Promise<unknown>;
    };
    prisma: {
        $disconnect(): Promise<void>;
    };
    /** Hard cap on the whole drain. Default 15s, comfortably under the usual 30s SIGKILL grace. */
    timeoutMs?: number;
    log?: (message: string) => void;
    exit?: (code: number) => void;
}
export declare const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15000;
/** Runs the drain, bounded by `timeoutMs`. Resolves to the exit code to use. */
export declare function shutdown(deps: ShutdownDeps): Promise<number>;
/**
 * Registers SIGTERM/SIGINT. A second signal while a drain is already running is
 * ignored rather than starting a second one: an impatient double Ctrl-C would
 * otherwise interrupt the very drain it was waiting for.
 */
export declare function installShutdownHandlers(deps: ShutdownDeps): void;
//# sourceMappingURL=shutdown.d.ts.map