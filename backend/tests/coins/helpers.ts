import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { applyCoinEvents, type CoinEarn, type EarnKind } from '../../src/coins/ledger';
import { authHeaderFor } from '../helpers/auth';
import { buddyUser } from '../buddies/helpers';

export async function coinUser(over: { timezone?: string } = {}) {
  const user = await buddyUser(over);
  return { user, headers: await authHeaderFor(user.id) };
}

/** Any earn, malformed ones included (the ledger's own checks are under test): hence the cast. */
export const earn = (kind: EarnKind, sourceKey: string, amount: number, capDay: string | null = null): CoinEarn =>
  ({ kind, sourceKey, amount, capDay }) as CoinEarn;

/** Coins for a test that spends: an uncapped row with a key of its own. */
export async function fund(userId: string, coins: number): Promise<void> {
  await applyCoinEvents(userId, [earn('firstweek', `test:${randomUUID()}`, coins)], new Date());
}

export const rowsOf = (userId: string) => prisma.coinEvent.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { sourceKey: 'asc' }] });
export const balance = async (userId: string) => (await prisma.coinWallet.findUnique({ where: { userId } }))?.balance ?? 0;
