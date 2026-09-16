import { randomUUID } from 'crypto';
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
    const user = await prisma.user.create({ data: { email: `t-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId: `fb-1-${randomUUID()}`,
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
    const user = await prisma.user.create({ data: { email: `t2-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId: `fb-2-${randomUUID()}`,
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

  // A transient DB failure after a successful refresh must not be mistaken for
  // a revoked grant; the connection is healthy and should stay CONNECTED.
  it('does not disconnect a healthy connection when the post-refresh write fails', async () => {
    const user = await prisma.user.create({
      data: { email: `t4-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const created = await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId: `fb-4-${randomUUID()}`,
        encryptedAccessToken: encryptToken('old-access'),
        encryptedRefreshToken: encryptToken('old-refresh'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    (oauth.refreshFitbitTokens as jest.Mock).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 28800,
      fitbitUserId: 'fb-4',
    });

    // Fail only this connection's write, so the assertion does not depend on
    // how many other connections the sweep happens to pick up.
    const realUpdate = prisma.fitbitConnection.update.bind(prisma.fitbitConnection);
    const updateSpy = jest
      .spyOn(prisma.fitbitConnection, 'update')
      .mockImplementation((args: any) =>
        args?.where?.id === created.id
          ? (Promise.reject(new Error('transient db failure')) as any)
          : realUpdate(args),
      );

    // The write failure is rethrown rather than swallowed into a disconnect.
    await expect(runTokenRefreshSweep()).rejects.toThrow('transient db failure');
    updateSpy.mockRestore();

    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('CONNECTED');
  });

  it('isolates a failing connection so other connections in the same sweep still refresh', async () => {
    const failingUser = await prisma.user.create({
      data: { email: `t3-fail-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const succeedingUser = await prisma.user.create({
      data: { email: `t3-ok-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    await prisma.fitbitConnection.create({
      data: {
        userId: failingUser.id,
        fitbitUserId: `fb-3-fail-${randomUUID()}`,
        encryptedAccessToken: encryptToken('old-access-fail'),
        encryptedRefreshToken: encryptToken('old-refresh-fail'),
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await prisma.fitbitConnection.create({
      data: {
        userId: succeedingUser.id,
        fitbitUserId: `fb-3-ok-${randomUUID()}`,
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
