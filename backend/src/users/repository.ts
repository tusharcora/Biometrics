import { prisma } from '../db/client';
import { AuthProvider } from '../types';

export async function findOrCreateUserByProvider(
  email: string,
  provider: AuthProvider,
  providerUserId: string,
): Promise<{ id: string }> {
  // Identity is the provider subject, never the email address. The stored email
  // is refreshed on each sign-in in case it changed at the provider.
  return prisma.user.upsert({
    where: { authProvider_providerUserId: { authProvider: provider, providerUserId } },
    update: { email },
    create: { email, authProvider: provider, providerUserId },
    select: { id: true },
  });
}
