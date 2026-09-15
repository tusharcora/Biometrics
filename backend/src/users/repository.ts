import { prisma } from '../db/client';
import { AuthProvider } from '../types';

export async function findOrCreateUserByProvider(
  email: string,
  provider: AuthProvider,
  providerUserId: string,
): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, authProvider: provider },
    select: { id: true },
  });
}
