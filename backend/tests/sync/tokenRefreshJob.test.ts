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

  it('isolates a failing connection so other connections in the same sweep still refresh', async () => {
    const failingUser = await prisma.user.create({
      data: { email: `t3-fail-${Date.now()}@example.com`, authProvider: 'GOOGLE' },
    });
    const succeedingUser = await prisma.user.create({
      data: { email: `t3-ok-${Date.now()}@example.com`, authProvider: 'GOOGLE' },
    });
    await prisma.fitbitConnection.create({
      data: {
        userId: failingUser.id,
        fitbitUserId: 'fb-3-fail',
        encryptedAccessToken: encryptToken('old-access-fail'),
        encryptedRefreshToken: encryptToken('old-refresh-fail'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await prisma.fitbitConnection.create({
      data: {
        userId: succeedingUser.id,
        fitbitUserId: 'fb-3-ok',
        encryptedAccessToken: encryptToken('old-access-ok'),
        encryptedRefreshToken: encryptToken('old-refresh-ok'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    (oauth.refreshFitbitTokens as jest.Mock).mockImplementation((refreshToken: string) => {
      if (refreshToken === 'old-refresh-fail') {
        return Promise.reject(new Error('invalid_grant'));
      }
      return Promise.resolve({
        accessToken: 'new-access-ok',
        refreshToken: 'new-refresh-ok',
        expiresIn: 28800,
        fitbitUserId: 'fb-3-ok',
      });
    });

    await runTokenRefreshSweep();

    const failingConn = await prisma.fitbitConnection.findUnique({ where: { userId: failingUser.id } });
    const succeedingConn = await prisma.fitbitConnection.findUnique({ where: { userId: succeedingUser.id } });

    expect(failingConn?.status).toBe('DISCONNECTED');
    expect(succeedingConn?.status).toBe('CONNECTED');
    expect(decryptToken(succeedingConn!.encryptedAccessToken)).toBe('new-access-ok');
  });
});
