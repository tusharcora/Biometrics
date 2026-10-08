// Chat DTOs (spec 2026-10-07 social §8). Mirrored exactly by mobile/src/api/chats.ts.

import type { AchievementFamily, CheckInMood, MessageKind, StickerKind } from '@prisma/client';
import type { PersonDTO } from '../buddies/people';

/** A quoted item's snapshot, built by the server (cards.ts) and stored as Message.card. */
export type CardDTO =
  // `about`: whose check-in — mine shared with "+" (sender), or theirs replied to from their story (recipient; no mood
  // when it was locked for me).
  | { type: 'checkin'; about: 'sender' | 'recipient'; localDate: string; mood: CheckInMood | null }
  | { type: 'badge'; family: AchievementFamily; level: number }
  | { type: 'recap'; recapKind: 'WEEK' | 'MONTH'; periodStart: string; periodEnd: string; line: string }
  | { type: 'goodnight'; onTime: boolean }
  | { type: 'note'; text: string }
  | { type: 'camp_note'; text: string };

export type CardType = CardDTO['type'];
export const CARD_TYPES: readonly CardType[] = ['checkin', 'badge', 'recap', 'goodnight', 'note', 'camp_note'];

/** The message a reply quotes: one line of it, or `gone` once it was unsent. */
export type ReplyPreviewDTO =
  | { id: string; gone: true }
  | { id: string; gone: false; mine: boolean; kind: MessageKind; text: string | null; sticker: StickerKind | null; cardType: CardType | null };

export interface ReactionDTO { kind: StickerKind; mine: boolean }

export interface MessageDTO {
  id: string;
  mine: boolean;
  kind: MessageKind;
  /** TEXT's text, or a CARD's reply. User free text. */
  text: string | null;
  sticker: StickerKind | null;
  card: CardDTO | null;
  replyTo: ReplyPreviewDTO | null;
  reactions: ReactionDTO[];
  createdAt: string;
}

export interface ThreadDTO {
  buddy: PersonDTO;
  /** Oldest first: one page. */
  messages: MessageDTO[];
  /** The cursor for the page before this one, or null at the start of the conversation. */
  nextBefore: string | null;
  /** When the buddy last read this conversation; only while both have read receipts on. */
  seenAt: string | null;
  /** When the buddy was last active (within 24 h); only while both show activity status. */
  activeAt: string | null;
}

/** A stored card's type, or null for anything this server never writes. */
export function cardTypeOf(card: unknown): CardType | null {
  const type = (card as { type?: unknown } | null)?.type;
  return (CARD_TYPES as readonly unknown[]).includes(type) ? (type as CardType) : null;
}
