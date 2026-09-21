import type { CoachModelProvider } from './model/provider';
import { UnconfiguredProvider } from './model/provider';

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
