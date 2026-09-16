import { randomUUID } from 'crypto';
import { Job } from 'bullmq';
import { processSyncJob } from '../../src/sync/worker';
import { connection } from '../../src/sync/queue';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import * as healthClient from '../../src/health/client';
import * as oauth from '../../src/health/oauth';
import * as subscriber from '../../src/health/subscriber';
import { encryptToken, decryptToken } from '../../src/crypto/tokenCipher';
import * as tokenRefreshJob from '../../src/sync/tokenRefreshJob';
import { TOKEN_REFRESH_SWEEP_JOB } from '../../src/sync/queue';

jest.mock('../../src/health/client');
jest.mock('../../src/health/oauth');
jest.mock('../../src/health/subscriber');
jest.mock('../../src/sync/tokenRefreshJob');

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

beforeEach(() => {
  // The worker attempts ONE in-line refresh on a 401 before disconnecting.
  // Default that refresh to failing so every pre-existing 401 test still
  // exercises the terminal disconnect path; the refresh-specific tests below
  // override this per test.
  (oauth.refreshHealthTokens as jest.Mock).mockReset().mockRejectedValue(new Error('invalid_grant'));
  (healthClient.fetchMetricRange as jest.Mock).mockReset();
  (subscriber.deleteUserSubscription as jest.Mock).mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

async function createConnectedUser() {
  const user = await prisma.user.create({ data: { email: `w-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
  await prisma.healthConnection.create({
    data: {
      userId: user.id,
      healthUserId: `fb-1-${randomUUID()}`,
      encryptedAccessToken: encryptToken('access-token'),
      encryptedRefreshToken: encryptToken('refresh-token'),
      tokenExpiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return user;
}

describe('processSyncJob', () => {
  it('writes fetched metric points for a fetch job', async () => {
    const user = await createConnectedUser();
    (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([
      { recordedAt: new Date('2026-09-01'), value: 8000 },
    ]);

    await processSyncJob({
      name: 'fetch',
      data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' },
    } as Job);

    const records = await prisma.biometricRecord.findMany({ where: { userId: user.id } });
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(8000);
  });

  // fetchMetricRange's ranges are half-open (end exclusive): dataPoints.list
  // filters `>= start AND < end`, so passing the same date twice is an empty
  // range and every webhook-driven fetch would return nothing forever.
  it('requests [date, date + 1) for a single-day fetch job, not [date, date)', async () => {
    const user = await createConnectedUser();
    (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([]);

    await processSyncJob({
      name: 'fetch',
      data: { userId: user.id, metricType: 'SLEEP', date: '2026-09-01' },
    } as Job);

    expect(healthClient.fetchMetricRange).toHaveBeenCalledTimes(1);
    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith('access-token', 'SLEEP', '2026-09-01', '2026-09-02');
  });

  it('rolls the exclusive end date over month and year boundaries', async () => {
    const user = await createConnectedUser();
    (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([]);

    await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-30' } } as Job);
    await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-12-31' } } as Job);

    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith('access-token', 'STEPS', '2026-09-30', '2026-10-01');
    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith('access-token', 'STEPS', '2026-12-31', '2027-01-01');
  });

  it('marks the connection disconnected on a 401 from Google Health', async () => {
    const user = await createConnectedUser();
    const err = new Error('unauthorized');
    (err as any).status = 401;
    (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(err);

    await processSyncJob({
      name: 'fetch',
      data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' },
    } as Job);

    const connection = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
    expect(connection?.status).toBe('DISCONNECTED');
  });

  it('processes a backfill job by fetching each metric type for the date range', async () => {
    const user = await createConnectedUser();
    (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([
      { recordedAt: new Date('2026-08-01'), value: 42 },
    ]);

    await processSyncJob({
      name: 'backfill',
      data: { userId: user.id, startDate: '2026-08-01', endDate: '2026-08-01' },
    } as Job);

    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'HRV',
      '2026-08-01',
      '2026-08-01',
    );
    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'RESTING_HR',
      '2026-08-01',
      '2026-08-01',
    );
    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'SLEEP',
      '2026-08-01',
      '2026-08-01',
    );
    expect(healthClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'STEPS',
      '2026-08-01',
      '2026-08-01',
    );
  });

  it('marks the connection disconnected on a 401 from Google Health during backfill', async () => {
    const user = await createConnectedUser();
    const err = new Error('unauthorized');
    (err as any).status = 401;
    (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(err);

    await processSyncJob({
      name: 'backfill',
      data: { userId: user.id, startDate: '2026-08-01', endDate: '2026-08-01' },
    } as Job);

    const connection = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
    expect(connection?.status).toBe('DISCONNECTED');
  });

  it('deletes the Google Health subscription when a fetch job hits a 401', async () => {
    const user = await prisma.user.create({ data: { email: `w-${Date.now()}-401@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    const conn = await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId: `health-user-401-${randomUUID()}`,
        encryptedAccessToken: encryptToken('access-token-401'),
        encryptedRefreshToken: encryptToken('refresh-token-401'),
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        webhookSubscriptionId: 'sub-to-delete',
      },
    });
    (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
    (subscriber.deleteUserSubscription as jest.Mock).mockResolvedValue(undefined);

    await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as any);

    expect(subscriber.deleteUserSubscription).toHaveBeenCalledWith('sub-to-delete');
    const updated = await prisma.healthConnection.findUnique({ where: { id: conn.id } });
    expect(updated?.status).toBe('DISCONNECTED');
  });

  it('still marks the connection DISCONNECTED even if deleting the subscription fails', async () => {
    const user = await prisma.user.create({ data: { email: `w-${Date.now()}-402@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    const conn = await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId: `health-user-402-${randomUUID()}`,
        encryptedAccessToken: encryptToken('access-token-402'),
        encryptedRefreshToken: encryptToken('refresh-token-402'),
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        webhookSubscriptionId: 'sub-that-fails',
      },
    });
    (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
    (subscriber.deleteUserSubscription as jest.Mock).mockRejectedValue(new Error('network error'));

    await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as any);

    const updated = await prisma.healthConnection.findUnique({ where: { id: conn.id } });
    expect(updated?.status).toBe('DISCONNECTED');
  });

  describe('in-line token refresh on 401', () => {
    const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 });

    async function createConnectedUserWithSubscription(subscriptionId: string) {
      const user = await prisma.user.create({
        data: { email: `w-refresh-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
      });
      await prisma.healthConnection.create({
        data: {
          userId: user.id,
          healthUserId: `health-user-refresh-${randomUUID()}`,
          encryptedAccessToken: encryptToken('stale-access'),
          encryptedRefreshToken: encryptToken('stored-refresh'),
          // Kept well outside runTokenRefreshSweep's one-hour lookahead:
          // tokenRefreshJob.test.ts runs in a parallel Jest worker against the
          // same DB and would otherwise sweep (and, with its rejecting mock,
          // disconnect) this row mid-test. The 401 mock is what drives the
          // refresh path here, not the stored expiry.
          tokenExpiresAt: new Date(Date.now() + 3 * 3600_000),
          webhookSubscriptionId: subscriptionId,
        },
      });
      return user;
    }

    it('refreshes once, persists the new tokens, retries with the new access token, and stays CONNECTED', async () => {
      const user = await createConnectedUserWithSubscription('sub-keep');
      (healthClient.fetchMetricRange as jest.Mock)
        .mockRejectedValueOnce(unauthorized())
        .mockResolvedValueOnce([{ recordedAt: new Date('2026-09-01'), value: 6500 }]);
      (oauth.refreshHealthTokens as jest.Mock).mockResolvedValue({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
        expiresIn: 7200,
      });

      await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as Job);

      // Refreshed with the STORED refresh token, exactly once.
      expect(oauth.refreshHealthTokens).toHaveBeenCalledTimes(1);
      expect(oauth.refreshHealthTokens).toHaveBeenCalledWith('stored-refresh');
      // First call with the stale token 401'd; the retry used the new one.
      expect(healthClient.fetchMetricRange).toHaveBeenCalledTimes(2);
      expect(healthClient.fetchMetricRange).toHaveBeenNthCalledWith(1, 'stale-access', 'STEPS', '2026-09-01', '2026-09-02');
      expect(healthClient.fetchMetricRange).toHaveBeenNthCalledWith(2, 'refreshed-access', 'STEPS', '2026-09-01', '2026-09-02');

      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('CONNECTED');
      expect(decryptToken(conn!.encryptedAccessToken)).toBe('refreshed-access');
      expect(decryptToken(conn!.encryptedRefreshToken)).toBe('refreshed-refresh');
      expect(conn!.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(conn?.lastSyncedAt).not.toBeNull();
      expect(subscriber.deleteUserSubscription).not.toHaveBeenCalled();

      const records = await prisma.biometricRecord.findMany({ where: { userId: user.id } });
      expect(records).toHaveLength(1);
      expect(records[0].value).toBe(6500);
    });

    it('keeps the stored refresh token when the in-line refresh does not return a new one', async () => {
      const user = await createConnectedUserWithSubscription('sub-keep-2');
      (healthClient.fetchMetricRange as jest.Mock)
        .mockRejectedValueOnce(unauthorized())
        .mockResolvedValueOnce([]);
      // Google's ordinary refresh_token grant omits refresh_token.
      (oauth.refreshHealthTokens as jest.Mock).mockResolvedValue({ accessToken: 'refreshed-access-only', expiresIn: 7200 });

      await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'HRV', date: '2026-09-01' } } as Job);

      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('CONNECTED');
      expect(decryptToken(conn!.encryptedAccessToken)).toBe('refreshed-access-only');
      expect(decryptToken(conn!.encryptedRefreshToken)).toBe('stored-refresh');
    });

    it('still disconnects and deletes the subscription when the refresh itself fails', async () => {
      const user = await createConnectedUserWithSubscription('sub-gone');
      (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(unauthorized());
      (oauth.refreshHealthTokens as jest.Mock).mockRejectedValue(new Error('invalid_grant'));

      await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as Job);

      expect(oauth.refreshHealthTokens).toHaveBeenCalledTimes(1);
      // No retry when there is no new token to retry with.
      expect(healthClient.fetchMetricRange).toHaveBeenCalledTimes(1);
      expect(subscriber.deleteUserSubscription).toHaveBeenCalledWith('sub-gone');
      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('DISCONNECTED');
      // The stale token is left untouched: nothing newer was ever obtained.
      expect(decryptToken(conn!.encryptedAccessToken)).toBe('stale-access');
    });

    it('still disconnects when the refresh succeeds but the retried fetch also 401s', async () => {
      const user = await createConnectedUserWithSubscription('sub-gone-2');
      (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(unauthorized());
      (oauth.refreshHealthTokens as jest.Mock).mockResolvedValue({ accessToken: 'refreshed-but-useless', expiresIn: 7200 });

      await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as Job);

      // Exactly one refresh and exactly one retry: no refresh loop.
      expect(oauth.refreshHealthTokens).toHaveBeenCalledTimes(1);
      expect(healthClient.fetchMetricRange).toHaveBeenCalledTimes(2);
      expect(healthClient.fetchMetricRange).toHaveBeenNthCalledWith(2, 'refreshed-but-useless', 'STEPS', '2026-09-01', '2026-09-02');
      expect(subscriber.deleteUserSubscription).toHaveBeenCalledWith('sub-gone-2');
      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('DISCONNECTED');
    });

    it('refreshes at most once per backfill job and uses the new token for the remaining metrics', async () => {
      const user = await createConnectedUserWithSubscription('sub-backfill');
      (healthClient.fetchMetricRange as jest.Mock)
        .mockRejectedValueOnce(unauthorized()) // HRV with the stale token
        .mockResolvedValue([]); // HRV retry + RESTING_HR + SLEEP + STEPS
      (oauth.refreshHealthTokens as jest.Mock).mockResolvedValue({ accessToken: 'refreshed-access', expiresIn: 7200 });

      await processSyncJob({
        name: 'backfill',
        data: { userId: user.id, startDate: '2026-08-01', endDate: '2026-08-31' },
      } as Job);

      expect(oauth.refreshHealthTokens).toHaveBeenCalledTimes(1);
      const calls = (healthClient.fetchMetricRange as jest.Mock).mock.calls;
      expect(calls).toHaveLength(5);
      expect(calls[0]).toEqual(['stale-access', 'HRV', '2026-08-01', '2026-08-31']);
      for (const call of calls.slice(1)) {
        expect(call[0]).toBe('refreshed-access');
      }
      expect(calls.slice(1).map((c) => c[1])).toEqual(['HRV', 'RESTING_HR', 'SLEEP', 'STEPS']);

      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('CONNECTED');
      expect(subscriber.deleteUserSubscription).not.toHaveBeenCalled();
    });

    it('does not disconnect on a non-401 error and does not attempt a refresh', async () => {
      const user = await createConnectedUserWithSubscription('sub-429');
      (healthClient.fetchMetricRange as jest.Mock).mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

      await expect(
        processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' } } as Job),
      ).rejects.toThrow('rate limited');

      expect(oauth.refreshHealthTokens).not.toHaveBeenCalled();
      const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
      expect(conn?.status).toBe('CONNECTED');
    });
  });

  // The sweep runs through the queue so that only one instance performs each
  // scheduled execution, rather than every process running its own setInterval.
  it('runs the token refresh sweep for a tokenRefreshSweep job', async () => {
    (tokenRefreshJob.runTokenRefreshSweep as jest.Mock).mockResolvedValue(undefined);

    await processSyncJob({ name: TOKEN_REFRESH_SWEEP_JOB, data: {} } as Job);

    expect(tokenRefreshJob.runTokenRefreshSweep).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown job name', async () => {
    (tokenRefreshJob.runTokenRefreshSweep as jest.Mock).mockClear();

    await expect(processSyncJob({ name: 'somethingElse', data: {} } as Job)).resolves.toBeUndefined();

    expect(tokenRefreshJob.runTokenRefreshSweep).not.toHaveBeenCalled();
  });
});
