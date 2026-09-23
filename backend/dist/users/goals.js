"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SLEEP_GOAL_MINUTES = void 0;
exports.resolveSleepGoalMinutes = resolveSleepGoalMinutes;
exports.getSleepGoalMinutes = getSleepGoalMinutes;
const client_1 = require("../db/client");
/**
 * Mirrors the `@default(480)` on User.sleepGoalMinutes in schema.prisma (a
 * Prisma default cannot reference a TS constant, so the two are kept in step by
 * hand). Anything that needs the sleep goal -- the sleep-debt factor, and later
 * the coach's getUserGoals() -- must read it through getSleepGoalMinutes, never
 * hardcode 480, so a user who customizes their goal changes it everywhere.
 */
exports.DEFAULT_SLEEP_GOAL_MINUTES = 480;
/** Pure: falls back to the default for a missing/invalid stored value. */
function resolveSleepGoalMinutes(stored) {
    return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : exports.DEFAULT_SLEEP_GOAL_MINUTES;
}
async function getSleepGoalMinutes(userId) {
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { sleepGoalMinutes: true } });
    return resolveSleepGoalMinutes(user?.sleepGoalMinutes);
}
//# sourceMappingURL=goals.js.map