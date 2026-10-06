// Buddy codes (spec 2026-10-06 buddies §4): 8 characters without look-alikes, 24 h, one active per
// owner, single use. Every failure of a redeem is the same code_invalid (unknown, expired, used,
// own, blocked either way). Codes older than 7 days are swept when a new one is made.

import { randomInt } from 'crypto';
import { prisma } from '../db/client';
import { RATE_LIMITS } from '../lib/rateLimit';
import { BuddyError, isUniqueViolation, limitOrThrow } from './errors';
import { createPair, isBlockedEitherWay, requirePairingReady, type PairDeps } from './pairs';

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const CODE_SWEEP_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

/** Upper-cased, spaces and dashes removed; null unless it is then a well-formed code. */
export function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

/** In one transaction: the owner's active codes expire now and the new one is inserted (retried on a collision). */
export async function createCode(ownerId: string, now: Date, opts: { generate?: () => string } = {}): Promise<{ code: string; expiresAt: Date }> {
  await requirePairingReady(ownerId);
  await prisma.buddyCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - CODE_SWEEP_MS) } } });
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = (opts.generate ?? generateCode)();
    try {
      await prisma.$transaction([
        prisma.buddyCode.updateMany({ where: { ownerId, usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
        prisma.buddyCode.create({ data: { code, ownerId, createdAt: now, expiresAt } }),
      ]);
      return { code, expiresAt };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('buddy_code_collisions');
}

export async function getActiveCode(ownerId: string, now: Date): Promise<{ code: string; expiresAt: Date } | null> {
  return prisma.buddyCode.findFirst({
    where: { ownerId, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: { code: true, expiresAt: true },
  });
}

/** The conditional update on usedAt IS NULL decides a concurrent redeem: one wins, the other gets code_invalid. */
export async function redeemCode(userId: string, raw: unknown, now: Date, deps: PairDeps = {}): Promise<{ buddyId: string }> {
  await requirePairingReady(userId);
  await limitOrThrow(RATE_LIMITS.codeRedeem, userId);
  const code = normaliseCode(raw);
  if (!code) throw new BuddyError('code_invalid');
  const row = await prisma.buddyCode.findUnique({ where: { code } });
  if (!row || row.usedAt || row.expiresAt <= now || row.ownerId === userId) throw new BuddyError('code_invalid');
  if (await isBlockedEitherWay(userId, row.ownerId)) throw new BuddyError('code_invalid');
  const taken = await prisma.buddyCode.updateMany({ where: { code, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now, usedById: userId } });
  if (taken.count === 0) throw new BuddyError('code_invalid');
  await createPair(userId, row.ownerId, now, deps);
  return { buddyId: row.ownerId };
}
