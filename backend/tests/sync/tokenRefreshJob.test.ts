import { runTokenRefreshSweep } from '../../src/sync/tokenRefreshJob';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { encryptToken, decryptToken } from '../../src/crypto/tokenCipher';
import * as oauth from '../../src/fitbit/oauth';

jest.mock('../../src/fitbit/oauth');

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('runTokenRefreshSweep', () => {
  it('refreshes connections expiring within the next hour', async () => {
    const user = await prisma.user.create({ data: { email: `t-${Date.now()}@example.com`, authProvider: 'GOOGLE' } });
    await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId: 'fb-1',
        encryptedAccessToken: encryptToken('old-access'),
        encryptedRefreshToken: encryptToken('old-refresh'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      },
    });
    (oauth.refreshFitbitTokens as jest.Mock).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 28800,
      fitbitUserId: 'fb-1',
    });

    await runTokenRefreshSweep();

    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(decryptToken(conn!.encryptedAccessToken)).toBe('new-access');
  });

  it('marks a connection disconnected when the refresh token has been revoked', async () => {
    const user = await prisma.user.create({ data: { email: `t2-${Date.now()}@example.com`, authProvider: 'GOOGLE' } });
    await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId: 'fb-2',
        encryptedAccessToken: encryptToken('old-access'),
        encryptedRefreshToken: encryptToken('old-refresh'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    (oauth.refreshFitbitTokens as jest.Mock).mockRejectedValue(new Error('invalid_grant'));

    await runTokenRefreshSweep();

    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('DISCONNECTED');
  });
});
