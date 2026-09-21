import type { CoachModelProvider } from './model/provider';
import { UnconfiguredProvider } from './model/provider';
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
let activeProvider: CoachModelProvider = new UnconfiguredProvider();

export function getCoachProvider(): CoachModelProvider {
  return activeProvider;
}

/** Wiring point for the provider that eventually clears the section 5 gate. Also used by tests. */
export function setCoachProvider(provider: CoachModelProvider): void {
  activeProvider = provider;
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
