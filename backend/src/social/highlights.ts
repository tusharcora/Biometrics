// Week highlights (spec 2026-10-07 social §7): one Monday–Sunday week of the viewer's circle, built on the first
// read after the week is FINAL and cached (plan ruling). Final = Monday 14:00 UTC, when every zone (down to UTC−12)
// has finished its Sunday; before that the previous week is served. The cache holds UNGATED candidates — every
// member's best badge, whoever shares streaks — and every read gates them again: an actor who is no longer a buddy
// drops out, and a badge item needs its actor to share streaks now (the viewer is exempt). A build with no
// candidates is cached empty for an hour, then rebuilt: badges are evaluated later (when their owner opens
// Achievements) with a back-dated earnedOn, so a quiet week can still gain one; once a build has items the row is
// frozen (S2 controller ruling; S1 never stored an empty week, and rebuilt it on every read). Closed item types, no
// health numbers:
// the only counts are the viewer's own stickers sent and received (never stickers between two of their buddies).
// "Joined" and "first badge" items (spec §7 `also`) are deferred to S2.

import type { AchievementFamily, CheckInMood, Prisma } from '@prisma/client';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import type { PersonDTO } from '../buddies/people';
import { lastCompletedPeriodStart } from '../recap/periods';
import { shiftDate } from '../scoring/dates';
import { loadCircle, type Circle, type Member } from './circle';

export type HighlightItem =
  | { type: 'top_story'; reason: 'badge'; actorId: string; family: AchievementFamily; level: number }
  | { type: 'top_story'; reason: 'checked_in_every_day'; actorId: string }
  | { type: 'most_cheered_you'; actorId: string; count: number }
  | { type: 'comeback'; actorId: string }
  | { type: 'checked_in_every_day'; actorId: string }
  | { type: 'most_stickers_sent'; actorId: string; count: number };

type WithoutActorId<T> = T extends unknown ? Omit<T, 'actorId'> & { actor: PersonDTO; mine: boolean } : never;
export type HighlightItemDTO = WithoutActorId<HighlightItem>;
export interface HighlightsDTO { weekStart: string; weekEnd: string; items: HighlightItemDTO[] }

const MAX_EVERY_DAY = 3;
const MIN_CHEERED_YOU = 2;
const MIN_STICKERS_SENT = 3;
/** Sunday 00:00 UTC + 1 day + 14 h = Monday 14:00 UTC. */
const READY_AFTER_SUNDAY_MS = (24 + 14) * 60 * 60 * 1000;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function highlightsReadyAt(weekStart: string): Date {
  return new Date(civilDateToUtcMidnight(shiftDate(weekStart, 6)).getTime() + READY_AFTER_SUNDAY_MS);
}

/** How long an EMPTY cached week is reused before it is rebuilt (a late-evaluated badge may land in it). */
export const EMPTY_WEEK_TTL_MS = 60 * 60 * 1000;

/** The newest week that is final for a viewer in `timeZone`: their last completed week, or the one before it until Monday 14:00 UTC. */
export function highlightsWeekFor(timeZone: string, now: Date): string {
  const latest = lastCompletedPeriodStart('WEEK', localCivilDateOrUtc(now, timeZone));
  return now.getTime() >= highlightsReadyAt(latest).getTime() ? latest : shiftDate(latest, -7);
}

function topBy(counts: Map<string, number>, min: number): [string, number] | null {
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best && best[1] >= min ? best : null;
}

/** RESTED on a day whose two previous local days were both TIRED. */
function bouncedBack(byDate: Map<string, CheckInMood>): boolean {
  return [...byDate.entries()].some(([date, mood]) =>
    mood === 'RESTED' && byDate.get(shiftDate(date, -1)) === 'TIRED' && byDate.get(shiftDate(date, -2)) === 'TIRED');
}

/** Ungated candidates in display order: every top-story candidate first (best first), then the other items. */
export async function buildHighlightCandidates(viewerId: string, memberIds: string[], weekStart: string): Promise<HighlightItem[]> {
  const from = civilDateToUtcMidnight(weekStart);
  const to = civilDateToUtcMidnight(shiftDate(weekStart, 6));
  const end = civilDateToUtcMidnight(shiftDate(weekStart, 7));
  const buddyIds = memberIds.filter((id) => id !== viewerId);
  const [checkIns, badges, stickers] = await Promise.all([
    prisma.checkIn.findMany({ where: { authorId: { in: memberIds }, localDate: { gte: from, lte: to } }, select: { authorId: true, localDate: true, mood: true } }),
    prisma.achievement.findMany({
      where: { userId: { in: memberIds }, earnedOn: { gte: from, lte: to } },
      orderBy: [{ level: 'desc' }, { earnedOn: 'asc' }, { userId: 'asc' }],
      select: { userId: true, family: true, level: true },
    }),
    // Only stickers the viewer sent to, or received from, a current buddy.
    prisma.sticker.findMany({
      where: { sentAt: { gte: from, lt: end }, OR: [{ toUserId: viewerId, fromUserId: { in: buddyIds } }, { fromUserId: viewerId, toUserId: { in: buddyIds } }] },
      select: { fromUserId: true, toUserId: true },
    }),
  ]);

  const moods = new Map<string, Map<string, CheckInMood>>();
  for (const c of checkIns) {
    const byDate = moods.get(c.authorId) ?? new Map<string, CheckInMood>();
    byDate.set(isoDate(c.localDate), c.mood);
    moods.set(c.authorId, byDate);
  }
  const everyDay = [...moods.entries()].filter(([, byDate]) => byDate.size === 7).map(([id]) => id).sort();
  const comeback = [...moods.entries()].filter(([, byDate]) => bouncedBack(byDate)).map(([id]) => id).sort()[0];
  const cheeredMe = new Map<string, number>();
  let sentByMe = 0;
  for (const s of stickers) {
    if (s.toUserId === viewerId) cheeredMe.set(s.fromUserId, (cheeredMe.get(s.fromUserId) ?? 0) + 1);
    else sentByMe += 1;
  }

  const items: HighlightItem[] = [];
  const withBadge = new Set<string>();
  for (const b of badges) {
    if (withBadge.has(b.userId)) continue; // each member's best badge only
    withBadge.add(b.userId);
    items.push({ type: 'top_story', reason: 'badge', actorId: b.userId, family: b.family, level: b.level });
  }
  if (everyDay[0]) items.push({ type: 'top_story', reason: 'checked_in_every_day', actorId: everyDay[0] });
  const cheered = topBy(cheeredMe, MIN_CHEERED_YOU);
  if (cheered) items.push({ type: 'most_cheered_you', actorId: cheered[0], count: cheered[1] });
  if (comeback) items.push({ type: 'comeback', actorId: comeback });
  for (const id of everyDay) items.push({ type: 'checked_in_every_day', actorId: id });
  if (sentByMe >= MIN_STICKERS_SENT) items.push({ type: 'most_stickers_sent', actorId: viewerId, count: sentByMe });
  return items;
}

/** Gate the stored candidates for this read: one top story (the first visible candidate), no repeats, ≤ 3 every-day. */
function visibleItems(stored: HighlightItem[], viewerId: string, members: Map<string, Member>): HighlightItemDTO[] {
  const visible: HighlightItemDTO[] = [];
  let top: HighlightItem | null = null;
  let everyDay = 0;
  for (const item of stored) {
    const actor = members.get(item.actorId);
    if (!actor) continue;
    if (item.type === 'top_story') {
      if (top) continue;
      if (item.reason === 'badge' && item.actorId !== viewerId && !actor.shares.streaks) continue;
      top = item;
    }
    if (item.type === 'checked_in_every_day') {
      const isTop = top?.type === 'top_story' && top.reason === 'checked_in_every_day' && top.actorId === item.actorId;
      if (isTop || everyDay >= MAX_EVERY_DAY) continue;
      everyDay += 1;
    }
    const { actorId, ...rest } = item;
    visible.push({ ...rest, actor: actor.person, mine: actorId === viewerId } as HighlightItemDTO);
  }
  return visible;
}

export async function weeklyHighlightsFor(circle: Circle, now: Date): Promise<HighlightsDTO | null> {
  const viewerId = circle.viewer.person.id;
  const weekStart = highlightsWeekFor(circle.viewer.timezone, now);
  const memberIds = [viewerId, ...circle.buddies.map((b) => b.person.id)];
  const weekDate = civilDateToUtcMidnight(weekStart);
  const key = { viewerId_weekStart: { viewerId, weekStart: weekDate } };
  let row = await prisma.weeklyHighlights.findUnique({ where: key, select: { items: true, builtAt: true } });
  // A non-empty row is frozen. An empty one is reused for an hour, then rebuilt: badges are evaluated later with a
  // back-dated earnedOn, so a quiet week can still gain an item.
  const expired = row !== null && (row.items as unknown[]).length === 0 && now.getTime() - row.builtAt.getTime() >= EMPTY_WEEK_TTL_MS;
  if (!row || expired) {
    const candidates = await buildHighlightCandidates(viewerId, memberIds, weekStart);
    const items = candidates as unknown as Prisma.InputJsonValue;
    if (row) {
      // Only the empty row read above: a concurrent rebuild that already replaced it wins.
      await prisma.weeklyHighlights.updateMany({ where: { viewerId, weekStart: weekDate, builtAt: row.builtAt }, data: { items, builtAt: now } });
    } else {
      await prisma.weeklyHighlights.createMany({ data: [{ viewerId, weekStart: weekDate, items, builtAt: now }], skipDuplicates: true });
    }
    row = await prisma.weeklyHighlights.findUniqueOrThrow({ where: key, select: { items: true, builtAt: true } });
  }
  const items = visibleItems(row.items as unknown as HighlightItem[], viewerId, circle.members);
  return items.length > 0 ? { weekStart, weekEnd: shiftDate(weekStart, 6), items } : null;
}

export async function getWeeklyHighlights(viewerId: string, now: Date): Promise<HighlightsDTO | null> {
  return weeklyHighlightsFor(await loadCircle(viewerId, now), now);
}
