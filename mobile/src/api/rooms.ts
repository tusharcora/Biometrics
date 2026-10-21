import { apiFetch } from './client';
import { send } from './buddies';

// KIP's room among buddies (spec 2026-10-15 §12 P4): visits, room cheers, gifts and the weekly challenge. The server
// decides who may see what, every coin and every count; the app only shows them. Shapes mirror backend/src/room
// (visit.ts, gifts.ts) and backend/src/challenges (entries.ts, judge.ts). Errors carry the buddy codes (ruling 25).
// sendGift's requestId is the gift's id: keep it for a retry after a dropped connection, drop it on any server answer
// (isServerAnswer in lib/coins/actions.ts, P2 ruling T9-FIX).
const id = (s: string) => encodeURIComponent(s);

export interface RoomVisitDTO {
  name: string;
  layout: unknown;
  size: { n: number; m: number };
  kipColour: string;
  kipWorn: Record<string, string | null>;
  cheersThisWeek: number;
  cheeredToday: boolean;
}
export const fetchBuddyRoom = (buddyId: string) => apiFetch<RoomVisitDTO>(`/me/buddies/${id(buddyId)}/room`);
export const cheerBuddyRoom = (buddyId: string) => apiFetch<{ paid: boolean }>(`/me/buddies/${id(buddyId)}/room/cheer`, send('POST', {}));
export interface RoomCheersDTO { count: number; cheers: Array<{ name: string; day: string }> }
export const fetchRoomCheers = () => apiFetch<RoomCheersDTO>('/me/room/cheers');

export type GiftNote = 'desk' | 'cosy' | 'thought';
export const GIFT_NOTES: readonly GiftNote[] = ['desk', 'cosy', 'thought'];
export interface GiftDTO { id: string; itemId: string; note: GiftNote; from: { name: string } | null; quiet: boolean; at: string }
export const sendGift = (buddyId: string, requestId: string, itemId: string, note: GiftNote) =>
  apiFetch<{ id: string; counts: Record<string, number> }>(`/me/buddies/${id(buddyId)}/gifts`, send('POST', { requestId, itemId, note }));
export const fetchGifts = () => apiFetch<{ gifts: GiftDTO[] }>('/me/gifts');
export const openGift = (giftId: string) => apiFetch<{ counts: Record<string, number> }>(`/me/gifts/${id(giftId)}/open`, send('POST', {}));

export type ChallengeTag = 'warm' | 'plant' | 'glow' | 'desk';
export type ThemeId = 'cosyAutumn' | 'greenThumb' | 'nightOwl' | 'tidyDesk';
export interface ChallengeEntryDTO {
  userId: string;
  name: string;
  kipColour: string;
  kipWorn: Record<string, string | null>;
  snapshot: { layout: unknown; size: { n: number; m: number } };
  cheers: number;
  cheeredByMe: boolean;
  mine: boolean;
}
export interface ChallengeResultsDTO {
  week: string;
  themeId: ThemeId | null;
  ranked: boolean;
  winners: string[];
  entries: Array<{ name: string; cheers: number; mine: boolean }>;
  you: { entered: boolean; won: boolean };
}
export interface ChallengeDTO {
  week: string;
  theme: { id: ThemeId; tag: ChallengeTag; atLeast: number; themePiece: string; trophy: string } | null;
  closesAt: string | null;
  open: boolean;
  entry: { count: number; meets: boolean; paid: boolean } | null;
  entries: ChallengeEntryDTO[];
  results: ChallengeResultsDTO | null;
}
export const fetchChallenge = () => apiFetch<ChallengeDTO>('/me/challenge');
export const enterChallenge = () => apiFetch<ChallengeDTO>('/me/challenge/entry', send('POST', {}));
export const cheerEntry = (userId: string) => apiFetch<{ paid: boolean }>(`/me/challenge/entries/${id(userId)}/cheer`, send('POST', {}));
