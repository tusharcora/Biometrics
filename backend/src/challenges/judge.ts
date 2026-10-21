// Results (spec 2026-10-15 §10.4, accepted default): on the first read after Monday 08:00 UTC, you win iff your entry
// has the most cheers (ties included) in YOUR circle, you plus the buddies who entered, frozen at your close
// (ChallengeEntry.circle, ruling 6), and only with at least 3 entries. A winner gets the week's trophy once
// (ItemGrant prize:{weekId}). Each entry is judged once (judgedAt). There is no public ranking: results list your circle
// only, by name (ruling 28), without anyone you blocked or who blocked you (PF4-F18). Nothing is logged but a failure's
// error name.
import { prisma } from '../db/client';
import { blockedEitherWay } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { buddyIdsOf } from '../social/circle';
import { themeFor, type ThemeId } from './themes';
import { previousWeek, resultsAt, weekOf } from './week';

export const MIN_RANKED = 3;

export function judgeCircle(counts: ReadonlyMap<string, number>): { ranked: boolean; winners: string[] } {
  if (counts.size < MIN_RANKED) return { ranked: false, winners: [] };
  const top = Math.max(...counts.values());
  return { ranked: true, winners: [...counts].filter(([, n]) => n === top).map(([id]) => id).sort() };
}

const idsOf = (json: unknown): string[] => (Array.isArray(json) ? json.filter((v): v is string => typeof v === 'string') : []);

/** Cheers per entrant of the week among the given ids (only those who entered). */
async function circleCounts(weekId: string, ids: readonly string[]): Promise<Map<string, number>> {
  const entered = await prisma.challengeEntry.findMany({ where: { weekId, userId: { in: [...ids] } }, select: { userId: true } });
  const got = await prisma.challengeCheer.groupBy({ by: ['toId'], where: { weekId, toId: { in: entered.map((e) => e.userId) } }, _count: { _all: true } });
  const counts = new Map(entered.map((e) => [e.userId, 0]));
  for (const g of got) counts.set(g.toId, g._count._all);
  return counts;
}

/** Judges this user's closed, unjudged entries (from Monday 08:00 UTC); answers how many this call judged. The
 * outcome (ranked, won) is stored with judgedAt (ruling T7-FIX), so a member deleted later never changes it. Two
 * reads at once: the conditional update decides which one judges, and only that one grants the trophy, in the same
 * transaction. */
export async function settleChallenges(userId: string, now: Date): Promise<number> {
  const open = await prisma.challengeEntry.findMany({ where: { userId, judgedAt: null }, select: { weekId: true, circle: true } });
  let judged = 0;
  for (const e of open) {
    if (now < resultsAt(e.weekId)) continue;
    const { ranked, winners } = judgeCircle(await circleCounts(e.weekId, [userId, ...idsOf(e.circle)]));
    const won = winners.includes(userId);
    const trophy = themeFor(e.weekId)?.trophy;
    const mine = await prisma.$transaction(async (tx) => {
      const done = await tx.challengeEntry.updateMany({ where: { userId, weekId: e.weekId, judgedAt: null }, data: { judgedAt: now, ranked, won } });
      if (done.count === 1 && won && trophy) {
        await tx.itemGrant.createMany({ data: [{ userId, itemId: trophy, qty: 1, sourceKey: `prize:${e.weekId}` }], skipDuplicates: true });
      }
      return done.count === 1;
    });
    if (mine) judged++;
  }
  return judged;
}

/** Never fails the read that triggers it (GET /me/challenge, GET /me/cosmetics); the next read tries again. */
export async function settleChallengesSafely(userId: string, now: Date): Promise<void> {
  try {
    await settleChallenges(userId, now);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'challenge.judge_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}

export interface ResultsDTO {
  week: string;
  themeId: ThemeId | null;
  ranked: boolean;
  winners: string[];
  entries: Array<{ name: string; cheers: number; mine: boolean }>;
  you: { entered: boolean; won: boolean };
}

/** Last week's results in your circle (your frozen circle if you entered, else your current buddies), or null before
 * Monday 08:00 UTC or when nobody in it entered. Names only, never ids (ruling 28). The ranking is the judged one (the
 * whole circle); anyone blocked either way is then left out of the names and the list (PF4-F18). */
export async function readResults(userId: string, now: Date): Promise<ResultsDTO | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const week = previousWeek(weekOf(now, me?.timezone ?? 'UTC'));
  if (now < resultsAt(week)) return null;
  const mine = await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId: week } }, select: { circle: true, ranked: true, won: true } });
  const counts = await circleCounts(week, [userId, ...(mine ? idsOf(mine.circle) : await buddyIdsOf(userId))]);
  if (!counts.size) return null;
  const hidden = new Set(await blockedEitherWay(userId));
  const shown = [...counts].filter(([id]) => !hidden.has(id));
  const people = await prisma.user.findMany({ where: { id: { in: shown.map(([id]) => id) } }, select: PERSON_SELECT });
  const name = (id: string) => { const p = people.find((u) => u.id === id); return p ? toPerson(p).displayName : ''; };
  const live = judgeCircle(counts);
  // Your own result is the stored one once judged (ruling T7-FIX); the live count only fills the rest.
  const ranked = mine?.ranked ?? live.ranked;
  const won = mine?.won ?? live.winners.includes(userId);
  const others = live.winners.filter((id) => id !== userId && !hidden.has(id));
  return {
    week, themeId: themeFor(week)?.id ?? null, ranked,
    winners: (won ? [userId, ...others] : others).map(name),
    entries: shown.sort((x, y) => y[1] - x[1]).map(([id, n]) => ({ name: name(id), cheers: n, mine: id === userId })),
    you: { entered: !!mine, won },
  };
}
