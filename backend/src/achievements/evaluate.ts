// evaluateAchievements (spec 2026-10-06 §5): computes each family's runs (or month count) since its
// start date and inserts every level the best run reached that is not stored yet. Idempotent and
// safe to run twice or concurrently: the (user, family, level) unique key decides, and a stored
// level is never updated or removed.

import type { AchievementFamily } from '@prisma/client';
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { mondayOf, monthStartOf } from '../recap/periods';
import { ALL_FAMILIES } from './catalogue';
import { loadAchievementInputs } from './data';
import { familyResults, type FamilyResult } from './families';

/** Each asked family's current, best and reachable levels; null when the user has no start date. */
export async function evaluateAchievements(
  userId: string,
  now: Date,
  families: readonly AchievementFamily[] = ALL_FAMILIES,
): Promise<FamilyResult[] | null> {
  const loaded = await loadAchievementInputs(userId, now);
  if (!loaded) return null;
  const results = familyResults(loaded.inputs, loaded.months, families);

  const stored = await prisma.achievement.findMany({ where: { userId }, select: { family: true, level: true } });
  const have = new Set(stored.map((s) => `${s.family}:${s.level}`));
  const fresh = results.flatMap((r) => r.reached.filter((l) => !have.has(`${r.family}:${l.level}`)).map((l) => ({ family: r.family, ...l })));
  if (fresh.length > 0) {
    await prisma.achievement.createMany({
      data: fresh.map((l) => ({
        userId,
        family: l.family,
        level: l.level,
        value: l.value,
        earnedOn: civilDateToUtcMidnight(l.earnedOn),
        weekStart: civilDateToUtcMidnight(mondayOf(l.earnedOn)),
        monthStart: civilDateToUtcMidnight(monthStartOf(l.earnedOn)),
      })),
      skipDuplicates: true,
    });
    // Ids, family and level only: never the health values behind them.
    for (const l of fresh) console.info(JSON.stringify({ event: 'achievements.awarded', userId, family: l.family, level: l.level }));
  }
  return results;
}
