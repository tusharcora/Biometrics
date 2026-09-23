"use strict";
// Coach consent (spec section 5). The coach gives score values, factor
// breakdowns, daily metrics, habit logs, confirmed habit-pattern fields and
// goals to an LLM on every turn, which the rest of the app never does, so it is gated
// on its own explicit, versioned opt-in that the SERVER enforces. Bumping
// COACH_CONSENT_VERSION invalidates every stored consent: the next message is
// refused (403 consent_required) until the user re-consents to the new text.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COACH_CONSENT = exports.COACH_CONSENT_VERSION = void 0;
exports.hasCurrentConsent = hasCurrentConsent;
exports.grantConsent = grantConsent;
exports.revokeConsent = revokeConsent;
const client_1 = require("../db/client");
// Version 2: the coach can also read daily metrics (steps, resting heart rate,
// HRV, sleep time) with up to 90 days of history, and recent habit logs.
exports.COACH_CONSENT_VERSION = '2';
exports.COACH_CONSENT = {
    version: exports.COACH_CONSENT_VERSION,
    summary: 'The coach uses an AI language model. When you send the coach a message, the items below are given to that model so ' +
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
/** True when the user's latest un-revoked consent is for the CURRENT version. */
async function hasCurrentConsent(userId) {
    const latest = await client_1.prisma.coachConsent.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { consentedAt: 'desc' },
        select: { version: true },
    });
    return latest?.version === exports.COACH_CONSENT_VERSION;
}
/** Idempotent: a repeat grant for the current version does not add a row. */
async function grantConsent(userId) {
    if (await hasCurrentConsent(userId))
        return;
    await client_1.prisma.coachConsent.create({ data: { userId, version: exports.COACH_CONSENT_VERSION } });
}
async function revokeConsent(userId) {
    await client_1.prisma.coachConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
//# sourceMappingURL=consent.js.map