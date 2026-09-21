// Coach consent (spec section 5). The coach sends score values, factor
// breakdowns, confirmed habit-pattern fields and goals to a third-party LLM
// provider on every turn, which the rest of the app never does, so it is gated
// on its own explicit, versioned opt-in that the SERVER enforces. Bumping
// COACH_CONSENT_VERSION invalidates every stored consent: the next message is
// refused (403 consent_required) until the user re-consents to the new text.

import { prisma } from '../db/client';

export const COACH_CONSENT_VERSION = '1';

export interface ConsentText {
  version: string;
  summary: string;
  dataItems: string[];
}

export const COACH_CONSENT: ConsentText = {
  version: COACH_CONSENT_VERSION,
  summary:
    'The coach uses an AI language model run by a third-party provider. When you send the coach a message, the items ' +
    'below are sent to that provider so it can answer, and only the items that message actually needs. Never sent: your ' +
    'sign-in or Google Health access tokens, your full biometric history, or your raw habit logs. The rest of the app ' +
    'works exactly the same if you decline, and you can withdraw this consent at any time.',
  dataItems: [
    'The messages you type to the coach in the current conversation',
    'Your Recovery Score and Sleep Score values, and how confident each one is',
    'The per-factor breakdown behind each score (for example HRV, resting heart rate, sleep debt, sleep duration, sleep efficiency and bedtime consistency)',
    'Habit patterns the app has already confirmed for you: the habit name, which factor it affects, the size of the effect and how many days it is based on',
    'Your goals, such as your sleep goal',
  ],
};

/** True when the user's latest un-revoked consent is for the CURRENT version. */
export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const latest = await prisma.coachConsent.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { consentedAt: 'desc' },
    select: { version: true },
  });
  return latest?.version === COACH_CONSENT_VERSION;
}

/** Idempotent: a repeat grant for the current version does not add a row. */
export async function grantConsent(userId: string): Promise<void> {
  if (await hasCurrentConsent(userId)) return;
  await prisma.coachConsent.create({ data: { userId, version: COACH_CONSENT_VERSION } });
}

export async function revokeConsent(userId: string): Promise<void> {
  await prisma.coachConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
