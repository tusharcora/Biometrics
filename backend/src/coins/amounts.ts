// What the coins pay, with no imports (spec 2026-10-15 §6.2, §6.3): the sources and the ledger use these, and the
// catalogue export copies them to the app for "How to earn" and the day's bar, so the app keeps no copy of its own.
/** C8's amounts, accepted at spec review (§0). Cheers and the challenge entry are written by P4. */
export const EARN_AMOUNTS = { sleep_goal: 20, steps: 15, checkin: 5, recap: 10, cheer: 2, challenge: 30 } as const;
/** What the capped kinds may pay on one civil day. */
export const DAILY_CAP = 60;
