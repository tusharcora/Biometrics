import { randomUUID } from 'crypto';
import { Job } from 'bullmq';
import { processSyncJob } from '../../src/sync/worker';
import { connection } from '../../src/sync/queue';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import * as fitbitClient from '../../src/fitbit/client';
import { encryptToken } from '../../src/crypto/tokenCipher';

jest.mock('../../src/fitbit/client');

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

async function createConnectedUser() {
  const user = await prisma.user.create({ data: { email: `w-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
  await prisma.fitbitConnection.create({
    data: {
      userId: user.id,
      fitbitUserId: `fb-1-${randomUUID()}`,
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
    (fitbitClient.fetchMetricRange as jest.Mock).mockResolvedValue([
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

  it('marks the connection disconnected on a 401 from Fitbit', async () => {
    const user = await createConnectedUser();
    const err = new Error('unauthorized');
    (err as any).status = 401;
    (fitbitClient.fetchMetricRange as jest.Mock).mockRejectedValue(err);

    await processSyncJob({
      name: 'fetch',
      data: { userId: user.id, metricType: 'STEPS', date: '2026-09-01' },
    } as Job);

    const connection = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(connection?.status).toBe('DISCONNECTED');
  });

  it('processes a backfill job by fetching each metric type for the date range', async () => {
    const user = await createConnectedUser();
    (fitbitClient.fetchMetricRange as jest.Mock).mockResolvedValue([
      { recordedAt: new Date('2026-08-01'), value: 42 },
    ]);

    await processSyncJob({
      name: 'backfill',
      data: { userId: user.id, startDate: '2026-08-01', endDate: '2026-08-01' },
    } as Job);

    expect(fitbitClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'HRV',
      '2026-08-01',
      '2026-08-01',
    );
    expect(fitbitClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'RESTING_HR',
      '2026-08-01',
      '2026-08-01',
    );
    expect(fitbitClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'SLEEP',
      '2026-08-01',
      '2026-08-01',
    );
    expect(fitbitClient.fetchMetricRange).toHaveBeenCalledWith(
      'access-token',
      'STEPS',
      '2026-08-01',
      '2026-08-01',
    );
  });

  it('marks the connection disconnected on a 401 from Fitbit during backfill', async () => {
    const user = await createConnectedUser();
    const err = new Error('unauthorized');
    (err as any).status = 401;
    (fitbitClient.fetchMetricRange as jest.Mock).mockRejectedValue(err);

    await processSyncJob({
      name: 'backfill',
      data: { userId: user.id, startDate: '2026-08-01', endDate: '2026-08-01' },
    } as Job);

    const connection = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(connection?.status).toBe('DISCONNECTED');
  });
});
