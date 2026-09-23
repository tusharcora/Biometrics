import type { CoachModelProvider } from './model/provider';
import { PushSender } from './push';
/**
 * The whole coach is behind COACH_ENABLED, default OFF. No LLM provider has been
 * cleared against the spec's data-handling gate, so this must not be switched on
 * in any environment a real user can reach. Read per request (not at import) so
 * it can be toggled without a restart in tests.
 */
export declare function isCoachEnabled(): boolean;
export declare function getCoachProvider(): CoachModelProvider;
/** Explicit provider override (tests, evals). Pass null to go back to COACH_PROVIDER. */
export declare function setCoachProvider(provider: CoachModelProvider | null): void;
/** Forget the env-built provider so the next call re-reads COACH_PROVIDER / OLLAMA_* (tests). */
export declare function resetCoachProviderFromEnv(): void;
/**
 * Latency budgets for a turn, overridable because a local model is much slower
 * than the 12 s the fast tier was designed around (a 27B on an M1 Pro answered
 * in 15-72 s in the spike). Unset means the orchestrator's defaults. The mobile
 * client gives up after its own timeout (EXPO_PUBLIC_COACH_TIMEOUT_MS), which
 * must be longer than the fast budget or answers arrive after it stopped waiting.
 */
export declare function getCoachBudgets(): {
    fast?: number;
    synthesis?: number;
} | undefined;
/** True when PUSH_PROVIDER selects the Expo push service. */
export declare function isExpoPushProvider(): boolean;
export declare function getPushSender(): PushSender;
/** Explicit sender override (tests). Pass null to fall back to PUSH_PROVIDER. */
export declare function setPushSender(sender: PushSender | null): void;
//# sourceMappingURL=config.d.ts.map