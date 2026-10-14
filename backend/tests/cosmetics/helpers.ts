import type { AchievementFamily } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';

export const day = civilDateToUtcMidnight;

/** A stored badge level, stored at `at`. */
export function level(userId: string, family: AchievementFamily, lvl: number, at: Date) {
  return prisma.achievement.create({
    data: { userId, family, level: lvl, value: lvl, earnedOn: day('2026-10-01'), weekStart: day('2026-09-28'), monthStart: day('2026-10-01'), createdAt: at },
  });
}

/** `n` built recaps of `kind`, opened at `openedAt` (null leaves them unopened). Period starts are distinct per call
 *  (the Recap key is userId + kind + periodStart): `offset` shifts them when a test makes more than one batch. */
export async function weekRecaps(userId: string, n: number, openedAt: Date | null, kind: 'WEEK' | 'MONTH' = 'WEEK', offset = 0) {
  for (let i = 0; i < n; i++) {
    const w = offset + i;
    await prisma.recap.create({
      data: {
        userId, kind, status: 'BUILT', sleepGoalMinutes: 480, openedAt,
        periodStart: new Date(Date.UTC(2026, 0, 5 + w * 7)), periodEnd: new Date(Date.UTC(2026, 0, 11 + w * 7)),
      },
    });
  }
}

/** One sticker from `from` to `to` at `at` (no pair needed: counting reads Sticker rows only). */
export function sticker(from: string, to: string, at: Date) {
  return prisma.sticker.create({ data: { fromUserId: from, toUserId: to, kind: 'CHEER', sentAt: at } });
}

export async function unlocked(userId: string) {
  return (await prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: { itemId: 'asc' } })).map((r) => ({ itemId: r.itemId, source: r.source }));
}
