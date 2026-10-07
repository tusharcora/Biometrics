// Stories (spec 2026-10-07 social §4.2). A story is the AUTHOR's local today: their check-in (locked for a viewer
// who hasn't checked in today), badges earned today (only while they share streaks; the top new level per family)
// and recaps they shared today (the headline line snapshotted when they shared it, period and coach — never the
// stats JSON, never the live Recap.line). Built at read time from the preloaded circle (whose check-ins also decide
// the lock) plus one query per remaining source. Rings: unseen first, then newest (plan ruling).

import type { AchievementFamily, CheckInMood } from '@prisma/client';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE } from '../buddies/errors';
import type { PersonDTO } from '../buddies/people';
import { todaysTopBadges } from './badges';
import { buddyIdsOf, loadCircle, membersById, type Circle, type Member } from './circle';

export type StoryFrameDTO =
  | { kind: 'checkin'; at: string; locked: true }
  | { kind: 'checkin'; at: string; locked: false; mood: CheckInMood }
  | { kind: 'badge'; at: string; family: AchievementFamily; level: number }
  | { kind: 'recap'; at: string; recapId: string; recapKind: 'WEEK' | 'MONTH'; periodStart: string; periodEnd: string; line: string; coachId: string };

export interface StoryDTO { author: PersonDTO; localDate: string; frames: StoryFrameDTO[] }
export interface StoryRingDTO { author: PersonDTO; unseen: boolean; locked: boolean; frameCount: number; latestAt: string }
export interface StoryRings { rings: StoryRingDTO[]; checkedInBuddies: number; viewerCheckedIn: boolean; checkedInCoachIds: string[] }

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Each author's local today, and the distinct dates among them (for `localDate in` filters). */
function authorTodays(authors: Member[], now: Date): { todayOf: Map<string, string>; dates: Date[] } {
  const todayOf = new Map(authors.map((a) => [a.person.id, localCivilDateOrUtc(now, a.timezone)]));
  return { todayOf, dates: [...new Set(todayOf.values())].map(civilDateToUtcMidnight) };
}

/** Each author's frames for their own local today. `unlocked` = the viewer may see check-in moods. */
async function loadFrames(authors: Member[], circle: Circle, now: Date, unlocked: boolean): Promise<Map<string, StoryFrameDTO[]>> {
  const ids = authors.map((a) => a.person.id);
  const { todayOf } = authorTodays(authors, now);
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const streakIds = authors.filter((a) => a.shares.streaks).map((a) => a.person.id);
  const [badges, shares] = await Promise.all([
    prisma.achievement.findMany({
      where: { userId: { in: streakIds }, createdAt: { gte: since } },
      select: { userId: true, family: true, level: true, earnedOn: true, createdAt: true },
    }),
    prisma.recapShare.findMany({
      where: { sharerId: { in: ids }, createdAt: { gte: since } },
      select: { sharerId: true, localDate: true, line: true, createdAt: true, recap: { select: { id: true, kind: true, periodStart: true, periodEnd: true } } },
    }),
  ]);
  const byAuthor = new Map<string, Array<StoryFrameDTO>>(ids.map((id) => [id, []]));
  const coachOf = new Map(authors.map((a) => [a.person.id, a.person.coachId]));
  const tzOf = new Map(authors.map((a) => [a.person.id, a.timezone]));
  for (const id of ids) {
    // The circle already holds each member's check-in for their own today.
    const c = circle.checkIns.get(id);
    if (!c) continue;
    byAuthor.get(id)!.push(unlocked
      ? { kind: 'checkin', at: iso(c.createdAt), locked: false, mood: c.mood }
      : { kind: 'checkin', at: iso(c.createdAt), locked: true });
  }
  const authorOf = (id: string) => (todayOf.has(id) ? { today: todayOf.get(id)!, timezone: tzOf.get(id)! } : undefined);
  for (const b of todaysTopBadges(badges, authorOf)) {
    byAuthor.get(b.userId)!.push({ kind: 'badge', at: iso(b.createdAt), family: b.family, level: b.level });
  }
  for (const s of shares) {
    // The line snapshotted at share time, never the live Recap.line (deletion or a rebuild may rewrite that).
    // shareRecap refuses an empty line; skip one anyway (rows from before the snapshot column default to '').
    if (isoDate(s.localDate) !== todayOf.get(s.sharerId) || !s.line) continue;
    byAuthor.get(s.sharerId)!.push({
      kind: 'recap', at: iso(s.createdAt), recapId: s.recap.id, recapKind: s.recap.kind,
      periodStart: isoDate(s.recap.periodStart), periodEnd: isoDate(s.recap.periodEnd), line: s.line, coachId: coachOf.get(s.sharerId)!,
    });
  }
  for (const frames of byAuthor.values()) frames.sort((a, b) => a.at.localeCompare(b.at));
  return byAuthor;
}

const MAX_CAMP_FACES = 2;

export async function storyRingsFor(circle: Circle, now: Date): Promise<StoryRings> {
  const viewerId = circle.viewer.person.id;
  const viewerCheckedIn = circle.checkIns.has(viewerId);
  const { buddies } = circle;
  const { todayOf, dates } = authorTodays(buddies, now);
  const [frames, seen] = await Promise.all([
    loadFrames(buddies, circle, now, viewerCheckedIn),
    prisma.storySeen.findMany({
      where: { viewerId, authorId: { in: buddies.map((b) => b.person.id) }, localDate: { in: dates } },
      select: { authorId: true, localDate: true },
    }),
  ]);
  const seenToday = new Set(seen.filter((s) => isoDate(s.localDate) === todayOf.get(s.authorId)).map((s) => s.authorId));
  const rings: StoryRingDTO[] = [];
  const checkIns: Array<{ coachId: string; at: string }> = [];
  for (const b of buddies) {
    const list = frames.get(b.person.id) ?? [];
    if (list.length === 0) continue;
    const checkIn = list.find((f) => f.kind === 'checkin');
    if (checkIn) checkIns.push({ coachId: b.person.coachId, at: checkIn.at });
    rings.push({ author: b.person, unseen: !seenToday.has(b.person.id), locked: checkIn !== undefined && !viewerCheckedIn, frameCount: list.length, latestAt: list[list.length - 1]!.at });
  }
  rings.sort((a, b) => Number(b.unseen) - Number(a.unseen) || b.latestAt.localeCompare(a.latestAt));
  checkIns.sort((a, b) => b.at.localeCompare(a.at));
  return { rings, checkedInBuddies: checkIns.length, viewerCheckedIn, checkedInCoachIds: checkIns.slice(0, MAX_CAMP_FACES).map((c) => c.coachId) };
}

export async function loadStoryRings(viewerId: string, now: Date): Promise<StoryRings> {
  return storyRingsFor(await loadCircle(viewerId, now), now);
}

async function requireAuthor(viewerId: string, authorId: string): Promise<{ viewer: Member; author: Member }> {
  if (!UUID_RE.test(authorId)) throw new BuddyError('not_buddies');
  if (authorId !== viewerId && !(await buddyIdsOf(viewerId)).includes(authorId)) throw new BuddyError('not_buddies');
  const members = await membersById([viewerId, authorId]);
  const viewer = members.get(viewerId);
  const author = members.get(authorId);
  if (!viewer || !author) throw new BuddyError('not_buddies');
  return { viewer, author };
}

export async function getStory(viewerId: string, authorId: string, now: Date): Promise<StoryDTO> {
  if (!UUID_RE.test(authorId)) throw new BuddyError('not_buddies');
  const circle = await loadCircle(viewerId, now);
  const author = circle.members.get(authorId);
  if (!author) throw new BuddyError('not_buddies');
  const unlocked = authorId === viewerId || circle.checkIns.has(viewerId);
  const frames = await loadFrames([author], circle, now, unlocked);
  return { author: author.person, localDate: localCivilDateOrUtc(now, author.timezone), frames: frames.get(authorId) ?? [] };
}

export async function markStorySeen(viewerId: string, authorId: string, now: Date): Promise<void> {
  const { author } = await requireAuthor(viewerId, authorId);
  const localDate = civilDateToUtcMidnight(localCivilDateOrUtc(now, author.timezone));
  await prisma.storySeen.createMany({ data: [{ viewerId, authorId, localDate, seenAt: now }], skipDuplicates: true });
}
