/**
 * Per-user guards for POST /me/coach/message.
 *
 * A coach turn is the most expensive thing this backend does: it can hold a
 * synthesis-tier model loop open for SYNTHESIS_TIER_BUDGET_MS (60s), and once a
 * real provider is wired every turn costs money. The endpoint had nothing in
 * front of it, so a double-tap on a slow network started two turns for the same
 * conversation -- two replies, two bills -- and nothing stopped a client from
 * holding several 60s loops open at once.
 *
 * Deliberately in-process. listen.ts already makes a second backend on the same
 * port exit rather than run alongside this one, so per-process state is
 * per-deployment state here. If that ever changes, this is the piece to move to
 * Redis, and the interface is shaped so that swap is local to this file.
 */
export declare class TurnInProgressError extends Error {
    constructor();
}
export declare class TurnRateLimitedError extends Error {
    readonly retryAfterSeconds: number;
    constructor(retryAfterSeconds: number);
}
/** Generous for a person typing, immediately obvious for a loop. */
export declare const RATE_LIMIT_MAX_TURNS = 15;
export declare const RATE_LIMIT_WINDOW_MS: number;
/**
 * Runs `fn` as this user's only in-flight turn, counting it against their rate
 * limit. Throws TurnRateLimitedError or TurnInProgressError instead of running.
 *
 * The lock is released in a finally, so a turn that throws does not wedge the
 * user out of the coach until restart.
 */
export declare function withTurnGuard<T>(userId: string, fn: () => Promise<T>, now?: number): Promise<T>;
/** Test seam: forget all guard state. */
export declare function resetTurnGuards(): void;
//# sourceMappingURL=turnGuard.d.ts.map