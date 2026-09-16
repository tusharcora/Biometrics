import request from 'supertest';
import { randomUUID, createHmac } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { encryptToken } from '../../src/crypto/tokenCipher';
import * as oauth from '../../src/fitbit/oauth';
import * as subscription from '../../src/fitbit/subscription';
import * as queue from '../../src/sync/queue';

jest.mock('../../src/fitbit/oauth');
jest.mock('../../src/fitbit/subscription');
// A bare `jest.mock('../../src/sync/queue')` (plain automock) still requires
// the real module once to introspect its shape, which runs its top-level
// `new IORedis(...)` as a side effect and leaves a real socket open that
// keeps Jest from exiting (same root cause flagged in Task 10's report for
// tests/sync/queue.test.ts and tests/sync/worker.test.ts). Supplying a
// factory here avoids ever loading the real module.
jest.mock('../../src/sync/queue', () => ({
  enqueueFetchJob: jest.fn(),
  enqueueBackfillJob: jest.fn(),
}));

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  process.env.FITBIT_VERIFY_CODE = 'verify-me';
  process.env.FITBIT_CLIENT_SECRET = 'client-secret';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

afterAll(async () => {
  await prisma.$disconnect();
});

function signBody(body: string): string {
  return createHmac('sha1', process.env.FITBIT_CLIENT_SECRET!).update(body).digest('base64');
}

async function createConnectedUser() {
  const user = await prisma.user.create({ data: { email: `wh-${randomUUID()}@example.com`, authProvider: 'GOOGLE' } });
  const fitbitUserId = `fitbit-${randomUUID()}`;
  await prisma.fitbitConnection.create({
    data: {
      userId: user.id,
      fitbitUserId,
      encryptedAccessToken: encryptToken('access-token'),
      encryptedRefreshToken: encryptToken('refresh-token'),
      tokenExpiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return { user, fitbitUserId };
}

describe('GET /webhooks/fitbit', () => {
  it('echoes back the verify code when it matches', async () => {
    const res = await request(createApp()).get('/webhooks/fitbit').query({ verify: 'verify-me' });
    expect(res.status).toBe(204);
  });

  it('returns 404 when the verify code does not match', async () => {
    const res = await request(createApp()).get('/webhooks/fitbit').query({ verify: 'wrong' });
    expect(res.status).toBe(404);
  });
});

describe('GET /fitbit/callback', () => {
  it('exchanges the code, stores the connection, registers a subscription, and enqueues a backfill', async () => {
    const user = await prisma.user.create({ data: { email: `f-${randomUUID()}@example.com`, authProvider: 'GOOGLE' } });
    const { accessToken } = await issueSessionTokens(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access',
      refreshToken: 'fitbit-refresh',
      expiresIn: 28800,
      fitbitUserId: 'fitbit-user-1',
    });

    const res = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code', state: user.id })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('CONNECTED');
    expect(subscription.registerWebhookSubscription).toHaveBeenCalled();
    expect(queue.enqueueBackfillJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
  });
});

describe('POST /webhooks/fitbit', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 for a bad or missing signature and enqueues nothing', async () => {
    const body = JSON.stringify([{ collectionType: 'sleep', date: '2026-09-01', ownerId: 'fitbit-user-x' }]);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
    expect(queue.enqueueFetchJob).not.toHaveBeenCalled();
  });

  it('marks the connection disconnected on a userRevokedAccess notification', async () => {
    const { user, fitbitUserId } = await createConnectedUser();
    const body = JSON.stringify([{ collectionType: 'userRevokedAccess', date: '2026-09-01', ownerId: fitbitUserId }]);
    const signature = signBody(body);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signature)
      .send(body);

    expect(res.status).toBe(204);
    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('DISCONNECTED');
  });

  it('enqueues a fetch job for a real notification against a seeded connection', async () => {
    const { user, fitbitUserId } = await createConnectedUser();
    const body = JSON.stringify([{ collectionType: 'sleep', date: '2026-09-02', ownerId: fitbitUserId }]);
    const signature = signBody(body);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signature)
      .send(body);

    expect(res.status).toBe(204);
    expect(queue.enqueueFetchJob).toHaveBeenCalledWith({
      userId: user.id,
      metricType: 'SLEEP',
      date: '2026-09-02',
    });
  });
});
