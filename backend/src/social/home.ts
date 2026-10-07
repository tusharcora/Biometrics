// The Social home in one call (spec 2026-10-07 social §4). The camp is static in S1: who in your circle checked in
// today, plus up to two of their coach faces. Unread counts feed the Social tab's dot: incoming buddy requests and
// unseen stickers from current buddies sent in the viewer's local today (chats join in S3) — the same window as the
// today timeline, so it counts only stickers Social shows. Those are marked seen by the Social screen once it has
// shown them (POST /me/social/stickers/seen), so the dot clears where the cause is read. Older unseen stickers stay
// unseen and keep their Buddies-side "new" marker until that buddy's week is opened.

import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { countRequests } from '../buddies/requests';
import type { PersonDTO } from '../buddies/people';
import { getTodayCheckIn, todayFor, type CheckInDTO } from './checkins';
import { buddyIdsOf, membersById } from './circle';
import { getWeeklyHighlights, type HighlightsDTO } from './highlights';
import { loadStoryRings, type StoryRingDTO } from './stories';
import { buildTimeline, TODAY_WINDOW_MS, type TimelineItemDTO } from './timeline';

export interface SocialHomeDTO {
  me: { person: PersonDTO; checkIn: CheckInDTO | null };
  camp: { checkedIn: number; members: number; faces: string[] };
  stories: StoryRingDTO[];
  highlights: HighlightsDTO | null;
  timeline: TimelineItemDTO[];
  unread: { requests: number; stickers: number };
}

/** Ids of the unseen stickers to the viewer from current buddies whose moment falls in the viewer's local today. */
async function unseenTodayStickerIds(viewerId: string, buddyIds: string[], now: Date): Promise<string[]> {
  if (buddyIds.length === 0) return [];
  const { timezone, today } = await todayFor(viewerId, now);
  const rows = await prisma.sticker.findMany({
    where: { toUserId: viewerId, seenAt: null, fromUserId: { in: buddyIds }, sentAt: { gte: new Date(now.getTime() - TODAY_WINDOW_MS) } },
    select: { id: true, sentAt: true },
  });
  return rows.filter((s) => localCivilDateOrUtc(s.sentAt, timezone) === today).map((s) => s.id);
}

export async function getSocialHome(viewerId: string, now: Date): Promise<SocialHomeDTO> {
  const buddyIds = await buddyIdsOf(viewerId);
  const [members, checkIn, rings, timeline, highlights, requests, stickers] = await Promise.all([
    membersById([viewerId]),
    getTodayCheckIn(viewerId, now),
    loadStoryRings(viewerId, now),
    buildTimeline(viewerId, now),
    getWeeklyHighlights(viewerId, now),
    countRequests(viewerId, now),
    unseenTodayStickerIds(viewerId, buddyIds, now),
  ]);
  return {
    me: { person: members.get(viewerId)!.person, checkIn },
    camp: {
      checkedIn: rings.checkedInBuddies + (rings.viewerCheckedIn ? 1 : 0),
      members: buddyIds.length + 1,
      faces: rings.checkedInCoachIds,
    },
    stories: rings.rings,
    highlights,
    timeline,
    unread: { requests: requests.incoming, stickers: stickers.length },
  };
}

/** The Social screen showed them: today's unseen stickers to the viewer from current buddies are now seen. */
export async function markStickersSeen(viewerId: string, now: Date): Promise<number> {
  const ids = await unseenTodayStickerIds(viewerId, await buddyIdsOf(viewerId), now);
  if (ids.length === 0) return 0;
  const result = await prisma.sticker.updateMany({ where: { id: { in: ids }, seenAt: null }, data: { seenAt: now } });
  return result.count;
}
