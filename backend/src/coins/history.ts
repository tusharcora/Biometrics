// Coin history (spec 2026-10-15 §6.7, §12): the balance, today's capped total against the cap (today is the user's
// civil date, not the 04:00 habit boundary), and the events newest first in cursor pages of 30, each a kind, an amount,
// a time and whether it was seen (ruling 35). Marking seen is the only update a coin event ever gets.
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { todayFor } from '../social/checkins';
import { CAPPED_KINDS, DAILY_CAP, balanceOf, type CoinKind } from './ledger';

export const HISTORY_PAGE = 30;
export interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }
export interface CoinsDTO { balance: number; today: { earned: number; cap: number }; events: CoinEventDTO[]; next: string | null }

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): { at: Date; id: string } | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw)) return null;
  const [iso, id, extra] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (extra !== undefined || !iso || !id) return null;
  const at = new Date(iso);
  return !Number.isNaN(at.getTime()) && at.toISOString() === iso ? { at, id } : null;
}

export async function readCoins(userId: string, now: Date, cursor?: string): Promise<CoinsDTO> {
  const after = cursor ? decodeCursor(cursor) : null;
  const { today } = await todayFor(userId, now);
  const [balance, earned, rows] = await Promise.all([
    balanceOf(prisma, userId),
    prisma.coinEvent.aggregate({ where: { userId, kind: { in: [...CAPPED_KINDS] }, capDay: civilDateToUtcMidnight(today) }, _sum: { amount: true } }),
    prisma.coinEvent.findMany({
      where: { userId, ...(after ? { OR: [{ createdAt: { lt: after.at } }, { createdAt: after.at, id: { lt: after.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_PAGE + 1,
      select: { id: true, kind: true, amount: true, createdAt: true, seenAt: true },
    }),
  ]);
  const page = rows.slice(0, HISTORY_PAGE);
  const last = page[page.length - 1];
  return {
    balance,
    today: { earned: earned._sum.amount ?? 0, cap: DAILY_CAP },
    events: page.map((r) => ({ kind: r.kind as CoinKind, amount: r.amount, at: r.createdAt.toISOString(), seen: r.seenAt !== null })),
    next: rows.length > HISTORY_PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** `{ through }`, an ISO instant: every event up to it is seen. False for any other body. */
export async function markCoinsSeen(userId: string, body: unknown, now: Date): Promise<boolean> {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).join(',') !== 'through' || typeof b.through !== 'string') return false;
  const through = new Date(b.through);
  if (Number.isNaN(through.getTime()) || through.toISOString() !== b.through) return false;
  await prisma.coinEvent.updateMany({ where: { userId, seenAt: null, createdAt: { lte: through } }, data: { seenAt: now } });
  return true;
}
