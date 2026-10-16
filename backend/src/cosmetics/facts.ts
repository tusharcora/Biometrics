// The facts the unlock rules read (spec 2026-10-14 KIP's room §3.2): badge levels, opened weekly recaps and cheers,
// all derived from existing rows; no counter is stored. Bounded reads: the highest thresholds are 12 recaps and 15
// cheers (the cheer scan pages until it has counted 15).
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import type { UnlockFacts } from './rules';

export const MAX_RECAPS_COUNTED = 12;
export const MAX_CHEERS_COUNTED = 15;
/** One page of the cheer scan (P4 ruling 18 pages it): 15 buddy-days × at most 6 stickers each. */
export const CHEER_SCAN_ROWS = 90;

/** One cheer per buddy per local day, in the sender's current zone, oldest first, at most 15. */
export function cheerTimes(rows: ReadonlyArray<{ toUserId: string; sentAt: Date }>, timezone: string): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const row of [...rows].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())) {
    const key = `${row.toUserId}|${localCivilDateOrUtc(row.sentAt, timezone)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.sentAt);
    if (out.length === MAX_CHEERS_COUNTED) break;
  }
  return out;
}

/**
 * Cheers, paged (spec 2026-10-15 §13; Spec B Task 3 minor, P4 ruling 18): CHEER_SCAN_ROWS rows at a time, oldest
 * first, until 15 cheers are counted or the rows run out, so a burst of stickers to one buddy never hides later ones.
 */
export async function loadCheerTimes(userId: string, timezone: string): Promise<Date[]> {
  const rows: Array<{ toUserId: string; sentAt: Date }> = [];
  let cursor: string | null = null;
  for (;;) {
    const page: Array<{ id: string; toUserId: string; sentAt: Date }> = await prisma.sticker.findMany({
      where: { fromUserId: userId },
      orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
      take: CHEER_SCAN_ROWS,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, toUserId: true, sentAt: true },
    });
    rows.push(...page);
    const times = cheerTimes(rows, timezone);
    if (times.length >= MAX_CHEERS_COUNTED || page.length < CHEER_SCAN_ROWS) return times;
    cursor = page[page.length - 1]!.id;
  }
}

export async function loadUnlockFacts(userId: string): Promise<UnlockFacts> {
  const [levels, recaps, user] = await Promise.all([
    prisma.achievement.findMany({ where: { userId }, select: { family: true, level: true, createdAt: true } }),
    prisma.recap.findMany({
      where: { userId, kind: 'WEEK', openedAt: { not: null } }, orderBy: { openedAt: 'asc' }, take: MAX_RECAPS_COUNTED, select: { openedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  return {
    levels: levels.map((l) => ({ family: l.family, level: l.level, at: l.createdAt })),
    recapsReadAt: recaps.map((r) => r.openedAt!),
    cheersAt: await loadCheerTimes(userId, user?.timezone ?? 'UTC'),
  };
}

export function countersOf(facts: UnlockFacts): { recapsRead: number; buddyCheers: number } {
  return { recapsRead: facts.recapsReadAt.length, buddyCheers: facts.cheersAt.length };
}
