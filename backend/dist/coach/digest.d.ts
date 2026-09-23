import { CoachClock } from './clock';
import { TurnToolResult } from './guardrails/grounding';
import type { CoachModelProvider } from './model/provider';
import { resolvePersona } from './personas';
import { PushSender } from './push';
import type { CoachTelemetry } from './telemetry';
import { CoachTools } from './tools';
export declare const DIGEST_WINDOW_DAYS = 7;
export declare const DIGEST_BUDGET_MS = 60000;
export declare const DIGEST_MAX_MODEL_CALLS = 6;
export interface DigestDeps {
    provider: CoachModelProvider;
    telemetry: CoachTelemetry;
    pushSender: PushSender;
    tools?: CoachTools;
    clock?: CoachClock;
    /** Injectable "now" so tests can pin the week. */
    now?: () => Date;
    budgetMs?: number;
    /** Restrict a run to these users (tests, manual backfill). Omit for the real sweep. */
    userIds?: string[];
}
export type DigestOutcome = 'generated' | 'skipped_reactive_only' | 'skipped_no_consent' | 'skipped_exists' | 'skipped_no_data' | 'failed';
export interface DigestSweepSummary {
    enabled: boolean;
    usersChecked: number;
    generated: number;
    skipped: number;
    failed: number;
}
/** The Monday (civil date) of the ISO week containing `civilDate`: the digest's idempotency key. */
export declare function weekStartOf(civilDate: string): string;
/**
 * The deterministic, server-composed recap (no model): a fixed template whose
 * every number and name comes from a {{reference}} resolved against the fetched
 * results. Returns null when there is nothing to say.
 */
export declare function composeDigestFallback(results: readonly TurnToolResult[]): string | null;
interface Generated {
    text: string;
    source: 'model' | 'fallback';
    rejects: number;
}
export declare function generateDigestText(deps: DigestDeps, userId: string, persona: ReturnType<typeof resolvePersona>, today: string, fetched: TurnToolResult[]): Promise<Generated | null>;
export declare function generateWeeklyDigestForUser(user: {
    id: string;
    timezone: string;
    coachPersonaId: string | null;
}, deps: DigestDeps): Promise<DigestOutcome>;
/** The scheduled job body. A no-op unless COACH_ENABLED. One user's failure never stops the sweep. */
export declare function runWeeklyDigest(deps: DigestDeps): Promise<DigestSweepSummary>;
export {};
//# sourceMappingURL=digest.d.ts.map