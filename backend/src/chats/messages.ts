// Messages (spec 2026-10-07 social §8.2): TEXT, STICKER (through the Buddies sticker, so its 5-a-day limit, unseen
// flag and buddy_sticker push stay in one place) and CARD. Only buddies; every refusal for a non-buddy is not_buddies.
// The order is: the body's shape (invalid_* before the limiter, so a malformed body spends nothing), the limiter
// (before the pair, like stickers: it counts only the sender's own sends and reveals nothing), then one transaction
// that checks the pair, writes and reads back the message it returns (after the commit a racing unpair could already
// have deleted it). Text is user free text: never logged, never sent to the coach.

import type { MessageKind, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/client';
import { encodeCursor, keysetBefore, parseCursor } from '../buddies/cursor';
import { BuddyError, UUID_RE, limitOrThrow } from '../buddies/errors';
import type { PairDeps } from '../buddies/pairs';
import { toPerson } from '../buddies/people';
import { sendSticker } from '../buddies/stickers';
import { RATE_LIMITS } from '../lib/rateLimit';
import { buildCard, gateCard, loadCardGate, parseCardRequest, type CardGate, type CardRequest } from './cards';
import { findConversationId, moveRead, requireChatPeople, requireLivePairTx, writeMessageTx } from './conversations';
import { activeAtFor, touchPresence } from './presence';
import { checkMessageText, previewText } from './text';
import { cardTypeOf, type MessageDTO, type StoredCard, type ThreadDTO } from './types';

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
    await touchPresence(senderId, now);
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
  const message = await prisma.$transaction(async (tx) => {
    await requireLivePairTx(tx, senderId, buddyId, now);
    const messageId = await writeMessageTx(tx, { senderId, recipientId: buddyId, kind, text, card, replyToMessageId, now });
    return loadMessageDTO(messageId, senderId, tx);
  });
  await touchPresence(senderId, now);
  return message;
}

export const THREAD_PAGE_SIZE = 50;

/**
 * One page of the thread, oldest first: the newest page without `before` (what the app polls every 5 s), else the page
 * before that cursor. Unsent messages are never returned. A pair with no conversation yet is an empty thread. "Seen"
 * and activity status follow the reciprocal settings. Every card on the page goes through one card gate, so it serves
 * only what is still shared now. Reading touches the reader's presence.
 */
export async function listThread(viewerId: string, buddyId: string, beforeRaw: unknown, now: Date, pageSize = THREAD_PAGE_SIZE): Promise<ThreadDTO> {
  const before = parseCursor(beforeRaw);
  const { viewer, buddy } = await requireChatPeople(viewerId, buddyId);
  await touchPresence(viewerId, now);
  const activeAt = activeAtFor(viewer, buddy, now);
  const conversationId = await findConversationId(viewerId, buddyId);
  if (!conversationId) return { buddy: toPerson(buddy), messages: [], nextBefore: null, seenAt: null, activeAt };
  const receipts = viewer.chatReadReceipts && buddy.chatReadReceipts;
  const [rows, newestElsewhere, read] = await Promise.all([
    prisma.message.findMany({
      where: { AND: [{ conversationId, deletedAt: null }, ...(before ? [keysetBefore('createdAt', before)] : [])] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      select: MESSAGE_SELECT,
    }),
    // An older page does not hold the thread's newest message; the newest page does (its first row).
    receipts && before ? newestLiveMessage(conversationId) : Promise.resolve(null),
    receipts
      ? prisma.conversationRead.findUnique({ where: { conversationId_readerId: { conversationId, readerId: buddyId } }, select: { lastReadAt: true } })
      : Promise.resolve(null),
  ]);
  const newest = before ? newestElsewhere : (rows[0] ?? null);
  const page = rows.slice(0, pageSize);
  const oldest = page[page.length - 1];
  const gate = await loadCardGate(page.map((row) => row.card));
  return {
    buddy: toPerson(buddy),
    messages: page.reverse().map((row) => toMessageDTO(row, viewerId, gate)),
    nextBefore: rows.length > pageSize && oldest ? encodeCursor({ at: oldest.createdAt, id: oldest.id }) : null,
    seenAt: seenAtFor(viewerId, newest, read),
    activeAt,
  };
}

function newestLiveMessage(conversationId: string): Promise<{ senderId: string; createdAt: Date } | null> {
  return prisma.message.findFirst({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { senderId: true, createdAt: true },
  });
}

/**
 * "Seen" is the time of the thread's newest live message, only when it is mine and the buddy's read has reached it
 * (`read` is null unless both have read receipts on). The buddy's lastReadAt itself is never sent: it moves on every
 * open and poll, so it would show when they are in the thread even with activity status off.
 */
function seenAtFor(viewerId: string, newest: { senderId: string; createdAt: Date } | null, read: { lastReadAt: Date } | null): string | null {
  if (!newest || !read || newest.senderId !== viewerId || read.lastReadAt < newest.createdAt) return null;
  return newest.createdAt.toISOString();
}

/** A conversation an unpair or block deleted mid-call (no FK target, no row): there is nothing left to mark. */
function isGoneRace(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'P2003' || code === 'P2025';
}

/**
 * The thread is open: my read moves to now (never back), and that buddy's unseen stickers to me are seen. A racing
 * unpair or block that deletes the conversation leaves nothing to mark, so that ends quietly rather than as a 500.
 */
export async function markRead(viewerId: string, buddyId: string, now: Date): Promise<void> {
  await requireChatPeople(viewerId, buddyId);
  const conversationId = await findConversationId(viewerId, buddyId);
  if (conversationId) {
    try {
      await moveRead(prisma, conversationId, viewerId, now);
    } catch (err) {
      if (!isGoneRace(err)) throw err;
      return;
    }
  }
  await prisma.sticker.updateMany({ where: { fromUserId: buddyId, toUserId: viewerId, seenAt: null }, data: { seenAt: now } });
}
