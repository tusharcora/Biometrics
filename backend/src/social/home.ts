// The Social home in one call (spec 2026-10-07 social §4). The camp is static in S1: who in your circle checked in
// today, plus up to two of their coach faces. Unread counts feed the Social tab's dot: incoming buddy requests and
// unseen stickers from current buddies (chats join in S3). Stickers are marked seen by the Social screen once it
// has shown them (POST /me/social/stickers/seen), so the dot clears where the cause is read.

import { prisma } from '../db/client';
import { countRequests } from '../buddies/requests';
import type { PersonDTO } from '../buddies/people';
import { getTodayCheckIn, type CheckInDTO } from './checkins';
import { buddyIdsOf, membersById } from './circle';
import { getWeeklyHighlights, type HighlightsDTO } from './highlights';
import { loadStoryRings, type StoryRingDTO } from './stories';
import { buildTimeline, type TimelineItemDTO } from './timeline';

export interface SocialHomeDTO {
  me: { person: PersonDTO; checkIn: CheckInDTO | null };
  camp: { checkedIn: number; members: number; faces: string[] };
  stories: StoryRingDTO[];
  highlights: HighlightsDTO | null;
  timeline: TimelineItemDTO[];
  unread: { requests: number; stickers: number };
}

const unseenStickersWhere = (viewerId: string, buddyIds: string[]) => ({ toUserId: viewerId, seenAt: null, fromUserId: { in: buddyIds } });

export async function getSocialHome(viewerId: string, now: Date): Promise<SocialHomeDTO> {
  const buddyIds = await buddyIdsOf(viewerId);
  const [members, checkIn, rings, timeline, highlights, requests, stickers] = await Promise.all([
    membersById([viewerId]),
    getTodayCheckIn(viewerId, now),
    loadStoryRings(viewerId, now),
    buildTimeline(viewerId, now),
    getWeeklyHighlights(viewerId, now),
    countRequests(viewerId, now),
    prisma.sticker.count({ where: unseenStickersWhere(viewerId, buddyIds) }),
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
    unread: { requests: requests.incoming, stickers },
  };
}

/** The Social screen showed them: every unseen sticker to the viewer from a current buddy is now seen. */
export async function markStickersSeen(viewerId: string, now: Date): Promise<number> {
  const buddyIds = await buddyIdsOf(viewerId);
  if (buddyIds.length === 0) return 0;
  const result = await prisma.sticker.updateMany({ where: unseenStickersWhere(viewerId, buddyIds), data: { seenAt: now } });
  return result.count;
}
