import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import {
  issueSessionTokens,
  verifyAccessToken,
  refreshSession,
  revokeRefreshToken,
} from '../../src/auth/jwt';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('session jwt lifecycle', () => {
  it('issues an access token that verifies to the same userId', async () => {
    const user = await prisma.user.create({ data: { email: 'a@example.com', authProvider: 'GOOGLE' } });
    const { accessToken } = await issueSessionTokens(user.id);
    expect(verifyAccessToken(accessToken).userId).toBe(user.id);
  });

  it('refreshes using the refresh token and rotates it', async () => {
    const user = await prisma.user.create({ data: { email: 'b@example.com', authProvider: 'GOOGLE' } });
    const { refreshToken } = await issueSessionTokens(user.id);
    const rotated = await refreshSession(refreshToken);
    expect(verifyAccessToken(rotated.accessToken).userId).toBe(user.id);
    expect(rotated.refreshToken).not.toBe(refreshToken);
  });

  it('rejects a refresh token after it has been revoked', async () => {
    const user = await prisma.user.create({ data: { email: 'c@example.com', authProvider: 'GOOGLE' } });
    const { refreshToken } = await issueSessionTokens(user.id);
    await revokeRefreshToken(refreshToken);
    await expect(refreshSession(refreshToken)).rejects.toThrow();
  });
});
