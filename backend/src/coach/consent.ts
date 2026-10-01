// Coach consent (spec section 5). The coach gives score values, factor
// breakdowns, daily metrics, habit logs, confirmed habit-pattern fields and
// goals to an LLM on every turn, which the rest of the app never does, so it is gated
// on its own explicit, versioned opt-in that the SERVER enforces. Bumping
// COACH_CONSENT_VERSION invalidates every stored consent: the next message is
// refused (403 consent_required) until the user re-consents to the new text.

import { prisma } from '../db/client';

// Version 2: the coach can also read daily metrics (steps, resting heart rate,
// HRV, sleep time) with up to 90 days of history, and recent habit logs.
export const COACH_CONSENT_VERSION = '2';

export interface ConsentText {
  version: string;
  summary: string;
  dataItems: string[];
}

export const COACH_CONSENT: ConsentText = {
  version: COACH_CONSENT_VERSION,
  summary:
    'The coach uses an AI language model. When you send the coach a message, the items below are given to that model so ' +
    'it can answer, and only the items that message actually needs. Never sent: your sign-in or Google Health access ' +
    'tokens, or the free-text notes on your habit logs. The rest of the app works exactly the same if you decline, and ' +
    'you can withdraw this consent at any time.',
  dataItems: [
    'The messages you type to the coach in the current conversation',
    'Your Recovery Score and Sleep Score values, and how confident each one is',
    'The per-factor breakdown behind each score (for example HRV, resting heart rate, sleep debt, sleep duration, sleep efficiency and bedtime consistency)',
    'Your daily readings: steps, resting heart rate, HRV and time asleep, for a given day or up to the last 90 days',
    'What you logged in the habit log over up to the last 30 days (amounts only, never your notes)',
    'Habit patterns the app has already confirmed for you: the habit name, which factor it affects, the size of the effect and how many days it is based on',
    'Your goals, such as your sleep goal and the daily step goal',
  ],
};

// The hosted engine's own opt-in (spec 2026-09-30 section 3), on top of the
// coach consent above: switching to the hosted model sends the question and
// the fact sheet to Anthropic. A separate scope with its own version, so the
// two texts are bumped independently. The "hosted-" prefix keeps the two
// version strings from ever being equal.
export const COACH_HOSTED_CONSENT_VERSION = 'hosted-1';

export const COACH_HOSTED_CONSENT: ConsentText = {
  version: COACH_HOSTED_CONSENT_VERSION,
  summary:
    'Your question and a summary of your recent health numbers are sent to Anthropic to write the answer. ' +
    "Anthropic doesn't use it to train models. You can switch back any time.",
  dataItems: [
    'The question you type and the recent messages of the current conversation',
    'A short summary of the health numbers the answer needs: your scores and their usual values, last night’s sleep, HRV, resting heart rate, confirmed habit patterns, goals and what you asked the coach to remember',
    'The same summary for the one-sentence recap of your day at the top of the Coach page',
    'Never sent: your name, email, account id, sign-in or Google Health tokens, or the notes on your habit logs',
  ],
};

export type ConsentScope = 'local' | 'hosted';

const SCOPE_COLUMN = { local: 'LOCAL', hosted: 'HOSTED' } as const;
const SCOPE_VERSION = { local: COACH_CONSENT_VERSION, hosted: COACH_HOSTED_CONSENT_VERSION } as const;

export function consentTextFor(scope: ConsentScope): ConsentText {
  return scope === 'hosted' ? COACH_HOSTED_CONSENT : COACH_CONSENT;
}

/**
 * True when the user's latest un-revoked consent OF THIS SCOPE is for that
 * scope's CURRENT version. Scoped because the latest row overall may be the
 * other scope's: a hosted grant must never read as a stale local consent.
 */
export async function hasCurrentConsent(userId: string, scope: ConsentScope = 'local'): Promise<boolean> {
  const latest = await prisma.coachConsent.findFirst({
    where: { userId, revokedAt: null, scope: SCOPE_COLUMN[scope] },
    orderBy: { consentedAt: 'desc' },
    select: { version: true },
  });
  return latest?.version === SCOPE_VERSION[scope];
}

/** Idempotent: a repeat grant for the current version of the scope does not add a row. */
export async function grantConsent(userId: string, scope: ConsentScope = 'local'): Promise<void> {
  if (await hasCurrentConsent(userId, scope)) return;
  await prisma.coachConsent.create({ data: { userId, version: SCOPE_VERSION[scope], scope: SCOPE_COLUMN[scope] } });
}

/**
 * 'all' (the default, and what DELETE /me/coach/consent has always meant)
 * withdraws both scopes; 'hosted' withdraws only the hosted opt-in. Either way
 * the user is back on the local engine, in the same transaction, so no message
 * can go to the hosted model after the revoke returns.
 */
export async function revokeConsent(userId: string, scope: 'hosted' | 'all' = 'all'): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.coachConsent.updateMany({
      where: { userId, revokedAt: null, ...(scope === 'hosted' ? { scope: 'HOSTED' as const } : {}) },
      data: { revokedAt: now },
    }),
    prisma.user.updateMany({ where: { id: userId }, data: { coachEngine: 'LOCAL' } }),
  ]);
}
