import type { CoachModelProvider } from './model/provider';
import { UnconfiguredProvider } from './model/provider';
import { ollamaProviderFromEnv } from './model/ollama';
import { ExpoPushSender, NoopPushSender, PushSender } from './push';

/**
 * The whole coach is behind COACH_ENABLED, default OFF. No LLM provider has been
 * cleared against the spec's data-handling gate, so this must not be switched on
 * in any environment a real user can reach. Read per request (not at import) so
 * it can be toggled without a restart in tests.
 */
export function isCoachEnabled(): boolean {
  const v = process.env.COACH_ENABLED?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

// The single provider slot. There is deliberately no failover provider: a
// fallback would have to clear the same data-handling bar (spec section 5).
//
// COACH_PROVIDER selects it: `ollama` is a model served by a local Ollama
// (model/ollama.ts; loopback-only unless OLLAMA_ALLOW_REMOTE=true, so health
// data stays on this machine); anything else, or unset, is the unconfigured
// provider and every turn takes the server-composed fallback. Built once, on
// first use. A bad Ollama configuration is logged and degrades to the
// unconfigured provider rather than crashing the server.
let overrideProvider: CoachModelProvider | null = null;
let envProvider: CoachModelProvider | null = null;

function providerFromEnv(): CoachModelProvider {
  if (process.env.COACH_PROVIDER?.trim().toLowerCase() !== 'ollama') return new UnconfiguredProvider();
  try {
    const provider = ollamaProviderFromEnv();
    console.log(JSON.stringify({ event: 'coach.provider_configured', provider: provider.id }));
    return provider;
  } catch (err) {
    console.error(JSON.stringify({ event: 'coach.provider_config_invalid', error: err instanceof Error ? err.message : 'unknown' }));
    return new UnconfiguredProvider();
  }
}

export function getCoachProvider(): CoachModelProvider {
  if (overrideProvider) return overrideProvider;
  return (envProvider ??= providerFromEnv());
}

/** Explicit provider override (tests, evals). Pass null to go back to COACH_PROVIDER. */
export function setCoachProvider(provider: CoachModelProvider | null): void {
  overrideProvider = provider;
}

/** Forget the env-built provider so the next call re-reads COACH_PROVIDER / OLLAMA_* (tests). */
export function resetCoachProviderFromEnv(): void {
  envProvider = null;
}

/**
 * Latency budgets for a turn, overridable because a local model is much slower
 * than the 12 s the fast tier was designed around (a 27B on an M1 Pro answered
 * in 15-72 s in the spike). Unset means the orchestrator's defaults. The mobile
 * client gives up after its own timeout (EXPO_PUBLIC_COACH_TIMEOUT_MS), which
 * must be longer than the fast budget or answers arrive after it stopped waiting.
 */
export function getCoachBudgets(): { fast?: number; synthesis?: number } | undefined {
  const read = (name: string): number | undefined => {
    const raw = process.env[name]?.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const fast = read('COACH_FAST_BUDGET_MS');
  const synthesis = read('COACH_SYNTHESIS_BUDGET_MS');
  if (fast === undefined && synthesis === undefined) return undefined;
  return { ...(fast !== undefined ? { fast } : {}), ...(synthesis !== undefined ? { synthesis } : {}) };
}

// The push slot. PUSH_PROVIDER=expo selects the Expo sender; anything else (the
// default) is the no-op sender, which delivers nothing. Push content is generic
// by construction (push.ts). Read per call, like COACH_ENABLED, so tests can
// switch it; setPushSender() is an explicit override that wins over the env.
let overrideSender: PushSender | null = null;
const noopSender = new NoopPushSender();
let expoSender: ExpoPushSender | null = null;

/** True when PUSH_PROVIDER selects the Expo push service. */
export function isExpoPushProvider(): boolean {
  return process.env.PUSH_PROVIDER?.trim().toLowerCase() === 'expo';
}

export function getPushSender(): PushSender {
  if (overrideSender) return overrideSender;
  if (isExpoPushProvider()) return (expoSender ??= new ExpoPushSender());
  return noopSender;
}

/** Explicit sender override (tests). Pass null to fall back to PUSH_PROVIDER. */
export function setPushSender(sender: PushSender | null): void {
  overrideSender = sender;
}
