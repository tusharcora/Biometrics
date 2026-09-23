import type { Express } from 'express';
import type { Server } from 'http';
export interface ListenOptions {
    /** Runs once the port is actually bound -- never when binding failed. */
    onListening: () => void;
    /** Where a failure message goes. Defaults to console.error. */
    log?: (message: string, err: Error) => void;
    /** How the process ends on failure. Defaults to process.exit. */
    exit?: (code: number) => void;
}
export declare function describeListenError(err: NodeJS.ErrnoException, port: number): string;
/**
 * Listens on `port` and calls `onListening` only when that really succeeded.
 *
 * Express 5 hands a listen failure to the listen callback as its first
 * argument (application.js registers the callback as the server's 'error'
 * handler too). A callback that ignores it, as server.ts's used to, reports
 * "listening" for a server that never bound its port -- and the process stays
 * alive, because its queue workers keep the event loop busy, so a second
 * backend started by mistake looks healthy while serving nothing. Fail loudly
 * and exit instead.
 */
export declare function listenOrExit(app: Express, port: number, options: ListenOptions): Server;
//# sourceMappingURL=listen.d.ts.map