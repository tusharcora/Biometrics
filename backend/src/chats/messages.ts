// Messages (spec 2026-10-07 social §8.2): TEXT, STICKER (through the Buddies sticker, so its 5-a-day limit, unseen
// flag and buddy_sticker push stay in one place) and CARD. Only buddies; every refusal for a non-buddy is not_buddies.
// The order is: the body's shape (invalid_* before the limiter, so a malformed body spends nothing), the limiter
// (before the pair, like stickers: it counts only the sender's own sends and reveals nothing), then one transaction
// that checks the pair, writes and reads back the message it returns (after the commit a racing unpair could already
// have deleted it). Text is user free text: never logged, never sent to the coach.

import type { MessageKind, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE, limitOrThrow } from '../buddies/errors';
import type { PairDeps } from '../buddies/pairs';
import { sendSticker } from '../buddies/stickers';
import { RATE_LIMITS } from '../lib/rateLimit';
import { buildCard, gateCard, loadCardGate, parseCardRequest, type CardGate, type CardRequest } from './cards';
import { requireLivePairTx, writeMessageTx } from './conversations';
import { checkMessageText, previewText } from './text';
import { cardTypeOf, type MessageDTO, type StoredCard } from './types';

export const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  kind: true,
  text: true,
  sticker: true,
  card: true,
  createdAt: true,
  replyTo: { select: { id: true, senderId: true, kind: true, text: true, sticker: true, card: true, deletedAt: true } },
  reactions: { select: { reactorId: true, kind: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

/** `gate`: from loadCardGate over the rows' cards (one per page), so a card serves only what is still shared now. */
export function toMessageDTO(row: MessageRow, viewerId: string, gate: CardGate): MessageDTO {
  const r = row.replyTo;
  return {
    id: row.id,
    mine: row.senderId === viewerId,
    kind: row.kind,
    text: row.text,
    sticker: row.sticker,
    card: gateCard(row.card, gate),
    replyTo: r === null
      ? null
      : r.deletedAt !== null
        ? { id: r.id, gone: true }
        : { id: r.id, gone: false, mine: r.senderId === viewerId, kind: r.kind, text: r.text === null ? null : previewText(r.text), sticker: r.sticker, cardType: cardTypeOf(r.card) },
    reactions: row.reactions.map((x) => ({ kind: x.kind, mine: x.reactorId === viewerId })),
    createdAt: row.createdAt.toISOString(),
  };
}

/** A send passes its transaction: read after the commit, a racing unpair could already have deleted the message. */
export async function loadMessageDTO(id: string, viewerId: string, db: Prisma.TransactionClient | PrismaClient = prisma): Promise<MessageDTO> {
  const row = await db.message.findUniqueOrThrow({ where: { id }, select: MESSAGE_SELECT });
  return toMessageDTO(row, viewerId, await loadCardGate([row.card], db));
}

/** Absent → null; anything but a uuid → message_gone (it can't name a message). */
function parseReplyTo(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) throw new BuddyError('message_gone');
  return raw;
}

/**
 * Body: { kind: 'TEXT', text } | { kind: 'STICKER', sticker } | { kind: 'CARD', card, text? }, each with an optional
 * replyToMessageId. Returns the stored message as the sender sees it.
 */
export async function sendMessage(senderId: string, buddyId: string, body: unknown, now: Date, deps: PairDeps = {}): Promise<MessageDTO> {
  const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const replyToMessageId = parseReplyTo(b.replyToMessageId);
  if (b.kind === 'STICKER') {
    const { message } = await sendSticker(senderId, buddyId, b.sticker, now, deps, {
      replyToMessageId,
      readMessageTx: (tx, messageId) => loadMessageDTO(messageId, senderId, tx),
    });
    return message;
  }
  let kind: MessageKind;
  let text: string | null;
  let cardRequest: CardRequest | null = null;
  if (b.kind === 'TEXT') {
    kind = 'TEXT';
    text = checkMessageText(b.text);
    if (text === null) throw new BuddyError('invalid_message');
  } else if (b.kind === 'CARD') {
    kind = 'CARD';
    cardRequest = parseCardRequest(b.card);
    // A card's reply text is optional; when sent it must be valid (whitespace only is refused: the app sends none).
    const hasText = b.text !== undefined && b.text !== null;
    text = hasText ? checkMessageText(b.text) : null;
    if (cardRequest === null || (hasText && text === null)) throw new BuddyError('invalid_message');
  } else {
    throw new BuddyError('invalid_message');
  }
  await limitOrThrow(RATE_LIMITS.message, senderId);
  await limitOrThrow(RATE_LIMITS.messageDay, senderId);
  // After the limiter (probing spends a token) and before the transaction (it only reads; the tx re-checks the pair).
  const card: StoredCard | null = cardRequest ? await buildCard(senderId, buddyId, cardRequest, now) : null;
  // The returned message is read inside the transaction (an unpair waits on the pair lock, then deletes it).
  return prisma.$transaction(async (tx) => {
    await requireLivePairTx(tx, senderId, buddyId, now);
    const messageId = await writeMessageTx(tx, { senderId, recipientId: buddyId, kind, text, card, replyToMessageId, now });
    return loadMessageDTO(messageId, senderId, tx);
  });
}
