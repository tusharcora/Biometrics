import { prisma } from '../db/client';

/**
 * Mirrors the `@default(480)` on User.sleepGoalMinutes in schema.prisma (a
 * Prisma default cannot reference a TS constant, so the two are kept in step by
 * hand). Anything that needs the sleep goal -- the sleep-debt factor, and later
 * the coach's getUserGoals() -- must read it through getSleepGoalMinutes, never
 * hardcode 480, so a user who customizes their goal changes it everywhere.
 */
export const DEFAULT_SLEEP_GOAL_MINUTES = 480;

/** Pure: falls back to the default for a missing/invalid stored value. */
export function resolveSleepGoalMinutes(stored: number | null | undefined): number {
  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SLEEP_GOAL_MINUTES;
}

export async function getSleepGoalMinutes(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sleepGoalMinutes: true } });
  return resolveSleepGoalMinutes(user?.sleepGoalMinutes);
}
