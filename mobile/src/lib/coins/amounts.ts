// What each P2 source pays (spec 2026-10-15 §6.2), mirroring backend/src/coins/sources.ts EARN_AMOUNTS, for the coin
// history's "How to earn". The server decides every amount actually paid; this only describes them.
export const EARN_AMOUNTS = { sleep_goal: 20, steps: 15, recap: 10, checkin: 5 } as const;
