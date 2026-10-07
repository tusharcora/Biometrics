import { apiFetch } from './client';
import { buddyErrorCode, type Person, type StickerKind } from './buddies';
import type { AchievementFamily } from './achievements';

// Social tab client (spec 2026-10-07 social). Types mirror the backend/src/social/*.ts DTOs exactly. Only a BARE
// 404 (no error code) means the backend predates Social; every other social error carries { error: code }.

export type CheckInMood = 'RESTED' | 'OKAY' | 'TIRED';
export interface CheckIn { mood: CheckInMood; localDate: string; updatedAt: string }

export type StoryFrame =
  // Locked = a buddy's check-in before I checked in today: no mood is sent.
  | { kind: 'checkin'; at: string; locked: true }
  | { kind: 'checkin'; at: string; locked: false; mood: CheckInMood }
  | { kind: 'badge'; at: string; family: AchievementFamily; level: number }
  // `line` is the headline snapshotted when the recap was shared (never empty), not the live recap line.
  | { kind: 'recap'; at: string; recapId: string; recapKind: 'WEEK' | 'MONTH'; periodStart: string; periodEnd: string; line: string; coachId: string };
export interface Story { author: Person; localDate: string; frames: StoryFrame[] }
export interface StoryRing { author: Person; unseen: boolean; locked: boolean; frameCount: number; latestAt: string }

/** `id` is opaque: a key for lists, never parsed. */
type Base = { id: string; at: string; actor: Person; mine: boolean };
export type TimelineItem =
  // Locked = a buddy's check-in before I checked in today: no mood is sent. My own check-in is never locked.
  | (Base & { kind: 'checkin'; locked: true })
  | (Base & { kind: 'checkin'; locked: false; mood: CheckInMood })
  | (Base & { kind: 'step_goal' })
  | (Base & { kind: 'badge'; badge: { family: AchievementFamily; level: number } })
  | (Base & { kind: 'sticker'; sticker: StickerKind; to: Person })
  | (Base & { kind: 'recap_share'; recapKind: 'WEEK' | 'MONTH' });

type Actor = { actor: Person; mine: boolean };
export type HighlightItem =
  | (Actor & { type: 'top_story'; reason: 'badge'; family: AchievementFamily; level: number })
  | (Actor & { type: 'top_story'; reason: 'checked_in_every_day' })
  | (Actor & { type: 'most_cheered_you'; count: number })
  | (Actor & { type: 'comeback' })
  | (Actor & { type: 'checked_in_every_day' })
  | (Actor & { type: 'most_stickers_sent'; count: number });
export interface Highlights { weekStart: string; weekEnd: string; items: HighlightItem[] }

export interface SocialHome {
  me: { person: Person; checkIn: CheckIn | null };
  /** `faces`: coach ids of up to two buddies who checked in today, newest first. */
  camp: { checkedIn: number; members: number; faces: string[] };
  stories: StoryRing[];
  highlights: Highlights | null;
  timeline: TimelineItem[];
  /** `chats` arrives with S3 (DMs); the tab dot reads requests + stickers until then. */
  unread: { requests: number; stickers: number; chats?: number };
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const isBare404 = (error: unknown) => (error as { status?: number } | null)?.status === 404 && buddyErrorCode(error) === null;
const id = (s: string) => encodeURIComponent(s);

/** null only for a bare 404: a backend older than Social. */
export async function fetchSocialHome(): Promise<SocialHome | null> {
  try {
    return await apiFetch<SocialHome>('/me/social');
  } catch (error) {
    if (isBare404(error)) return null;
    throw error;
  }
}

export const saveCheckIn = (mood: CheckInMood) => apiFetch<{ checkIn: CheckIn }>('/me/social/checkin', send('PUT', { mood }));
export const fetchStory = (authorId: string) => apiFetch<Story>(`/me/social/stories/${id(authorId)}`);
// The seen routes answer 204.
export async function markStorySeen(authorId: string): Promise<void> {
  await apiFetch<void>(`/me/social/stories/${id(authorId)}/seen`, send('POST'));
}
export async function markStickersSeen(): Promise<void> {
  await apiFetch<void>('/me/social/stickers/seen', send('POST'));
}
// `line` is the text the user previewed; the server refuses the share if the recap's line has changed since.
export const shareRecap = (recapId: string, line: string) =>
  apiFetch<{ shared: true }>('/me/social/recap-shares', send('POST', { recapId, line }));
export async function unshareRecap(recapId: string): Promise<void> {
  await apiFetch<void>(`/me/social/recap-shares/${id(recapId)}`, send('DELETE'));
}

/** Whether I already share this recap; null on an older server (bare 404), where sharing doesn't exist. */
export async function fetchRecapShared(recapId: string): Promise<boolean | null> {
  try {
    return (await apiFetch<{ shared: boolean }>(`/me/social/recap-shares/${id(recapId)}`)).shared;
  } catch (error) {
    if (isBare404(error)) return null;
    throw error;
  }
}

export async function fetchHighlights(): Promise<Highlights | null> {
  return (await apiFetch<{ highlights: Highlights | null }>('/me/social/highlights')).highlights;
}
