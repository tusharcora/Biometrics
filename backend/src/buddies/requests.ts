// Buddy requests (spec 2026-10-06 buddies §4). Every state the sender can't be told about looks
// exactly like an unanswered request that later expired: "pending" to the sender means PENDING or
// DECLINED, not withdrawn, sent less than 14 days ago. Hidden rows (swallowed after a decline, or
// to/from someone who blocked the sender) never reach the recipient, never push, never pair.

import type { BuddyRequestStatus } from '@prisma/client';
import { prisma } from '../db/client';
import { RATE_LIMITS } from '../lib/rateLimit';
import { BuddyError, isUniqueViolation, limitOrThrow } from './errors';
import { checkHandle } from './identity';
import { enqueueBuddyNotice } from './notifyQueue';
import { createPairTx, enqueuePaired, existingPairAfter, findPair, isBlockedEitherWay, requirePairingReady, type PairDeps, type PairResult } from './pairs';
import { PERSON_SELECT, toPerson, type PersonDTO } from './people';

export const REQUEST_TTL_DAYS = 14;
export const DECLINE_SWALLOW_DAYS = 30;
export const MAX_PENDING_OUTGOING = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const ttlCutoff = (now: Date) => new Date(now.getTime() - REQUEST_TTL_DAYS * DAY_MS);

export interface RequestRow {
  status: BuddyRequestStatus;
  hidden: boolean;
  createdAt: Date;
  withdrawnAt: Date | null;
}

export function senderSeesPending(row: RequestRow, now: Date): boolean {
  return (row.status === 'PENDING' || row.status === 'DECLINED') && row.withdrawnAt === null && row.createdAt > ttlCutoff(now);
}

export function recipientSees(row: RequestRow, now: Date): boolean {
  return row.status === 'PENDING' && !row.hidden && row.createdAt > ttlCutoff(now);
}

export const senderPendingWhere = (now: Date) => ({
  status: { in: ['PENDING', 'DECLINED'] as BuddyRequestStatus[] },
  withdrawnAt: null,
  createdAt: { gt: ttlCutoff(now) },
});

export const recipientVisibleWhere = (now: Date) => ({ status: 'PENDING' as const, hidden: false, createdAt: { gt: ttlCutoff(now) } });

/** Lazy sweep: PENDING rows 14 days old become EXPIRED (the partial unique index then frees the ordered pair). */
export async function expireStaleRequests(userId: string, now: Date): Promise<void> {
  await prisma.buddyRequest.updateMany({
    where: { status: 'PENDING', createdAt: { lte: ttlCutoff(now) }, OR: [{ fromUserId: userId }, { toUserId: userId }] },
    data: { status: 'EXPIRED' },
  });
}

const visibleCrossed = (fromId: string, toId: string, now: Date) =>
  prisma.buddyRequest.findFirst({ where: { fromUserId: fromId, toUserId: toId, ...recipientVisibleWhere(now) }, select: { id: true } });

interface TargetLookup {
  id: string;
  blockedByMe: boolean;
  blocksMe: boolean;
  declinedMe: boolean;
}

/**
 * The target by handle, both block directions and a recent decline of my request, in one statement
 * whatever the answer: a block or a decline costs no extra database work, so timing can't reveal it.
 */
async function lookupTarget(handle: string, fromId: string, now: Date): Promise<TargetLookup | null> {
  const swallowSince = new Date(now.getTime() - DECLINE_SWALLOW_DAYS * DAY_MS);
  const rows = await prisma.$queryRaw<TargetLookup[]>`
    SELECT u."id",
      EXISTS (SELECT 1 FROM "BuddyBlock" b WHERE b."blockerId" = ${fromId} AND b."blockedId" = u."id") AS "blockedByMe",
      EXISTS (SELECT 1 FROM "BuddyBlock" b WHERE b."blockerId" = u."id" AND b."blockedId" = ${fromId}) AS "blocksMe",
      EXISTS (
        SELECT 1 FROM "BuddyRequest" r
        WHERE r."fromUserId" = ${fromId} AND r."toUserId" = u."id" AND r."status" = 'DECLINED' AND r."respondedAt" > ${swallowSince}
      ) AS "declinedMe"
    FROM "User" u
    WHERE u."handle" = ${handle}`;
  return rows[0] ?? null;
}

/**
 * Crossed requests: pair in one transaction that re-checks a block either way first (a block made
 * meanwhile wins; the caller's request then stays as it is). buddy_paired is enqueued after commit.
 */
async function pairCrossed(a: string, b: string, now: Date, deps: PairDeps): Promise<boolean> {
  let result: PairResult | null;
  try {
    result = await prisma.$transaction(async (tx) => ((await isBlockedEitherWay(a, b, tx)) ? null : createPairTx(tx, a, b, now)));
  } catch (err) {
    result = await existingPairAfter(err, a, b);
  }
  if (result?.created) await enqueuePaired(a, b, deps);
  return result !== null;
}

/**
 * POST to an exact handle. Only unknown/held/malformed handles answer not_found; a handle you
 * blocked answers blocked_by_you; everything else is the same success.
 */
export async function sendRequest(fromId: string, rawHandle: unknown, now: Date, deps: PairDeps = {}): Promise<void> {
  const me = await requirePairingReady(fromId);
  const check = checkHandle(rawHandle);
  if (!check.ok) throw new BuddyError('not_found');
  if (check.handle === me.handle) throw new BuddyError('own_handle');
  // A held handle has no owner, so it is not_found like an unknown one.
  const target = await lookupTarget(check.handle, fromId, now);
  if (!target) throw new BuddyError('not_found');
  if (target.blockedByMe) throw new BuddyError('blocked_by_you');
  if (await findPair(fromId, target.id)) return;
  await expireStaleRequests(fromId, now);
  const visible = await prisma.buddyRequest.findFirst({ where: { fromUserId: fromId, toUserId: target.id, ...senderPendingWhere(now) }, select: { id: true } });
  if (visible) return;

  // Crossed: the target already asked me (a hidden request never counts; nor does one across a block).
  if ((await visibleCrossed(target.id, fromId, now)) && !target.blocksMe && (await pairCrossed(fromId, target.id, now, deps))) return;

  await limitOrThrow(RATE_LIMITS.buddyRequest, fromId);
  const pending = await prisma.buddyRequest.count({ where: { fromUserId: fromId, ...senderPendingWhere(now) } });
  if (pending >= MAX_PENDING_OUTGOING) throw new BuddyError('too_many_pending');

  const hidden = target.blocksMe || target.declinedMe;
  let row: { id: string };
  try {
    row = await prisma.buddyRequest.create({ data: { fromUserId: fromId, toUserId: target.id, hidden, createdAt: now }, select: { id: true } });
  } catch (err) {
    // The partial unique index: a concurrent identical send already stored the PENDING row.
    if (isUniqueViolation(err)) return;
    throw err;
  }
  // From here the path is the same for a hidden row and a visible one: the route's work and timing
  // never tell a swallowed or blocked request apart from a real one.

  // Re-checked after our row is committed: of two simultaneous crossed sends, the later check
  // always sees the other's row, so exactly one pair comes out. The query runs either way; across a
  // block it never pairs.
  if ((await visibleCrossed(target.id, fromId, now)) && !target.blocksMe && (await pairCrossed(fromId, target.id, now, deps))) return;
  // One job per send, hidden or not. The job drops a hidden request, and writes the REQUEST
  // Activity row and sends the push for a visible one. Never awaited past its bound.
  await enqueueBuddyNotice({ kind: 'buddy_request', recipientId: target.id, actorId: fromId, refId: row.id, slots: {} }, deps.notifyQueue ? { queue: deps.notifyQueue } : {});
}

export interface IncomingRequestDTO { id: string; createdAt: string; from: PersonDTO }
export interface OutgoingRequestDTO { id: string; createdAt: string; toHandle: string }

/**
 * Incoming: what the recipient may see. Outgoing: every row the sender sees as pending, with nothing
 * that tells their states apart. Reading the incoming list backfills a missing REQUEST Activity row
 * for each visible request, so a lost enqueue never loses the Activity item.
 */
export async function listRequests(userId: string, now: Date): Promise<{ incoming: IncomingRequestDTO[]; outgoing: OutgoingRequestDTO[] }> {
  await expireStaleRequests(userId, now);
  const [incoming, outgoing] = await Promise.all([
    prisma.buddyRequest.findMany({
      where: { toUserId: userId, ...recipientVisibleWhere(now) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true, fromUser: { select: PERSON_SELECT } },
    }),
    prisma.buddyRequest.findMany({
      where: { fromUserId: userId, ...senderPendingWhere(now) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true, toUser: { select: { handle: true } } },
    }),
  ]);
  if (incoming.length > 0) {
    await prisma.buddyActivity.createMany({
      data: incoming.map((r) => ({ recipientId: userId, actorId: r.fromUser.id, kind: 'REQUEST' as const, refId: r.id, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
  }
  return {
    incoming: incoming.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), from: toPerson(r.fromUser) })),
    outgoing: outgoing.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), toHandle: r.toUser.handle ?? '' })),
  };
}

export async function countRequests(userId: string, now: Date): Promise<{ incoming: number; outgoing: number }> {
  const [incoming, outgoing] = await Promise.all([
    prisma.buddyRequest.count({ where: { toUserId: userId, ...recipientVisibleWhere(now) } }),
    prisma.buddyRequest.count({ where: { fromUserId: userId, ...senderPendingWhere(now) } }),
  ]);
  return { incoming, outgoing };
}
