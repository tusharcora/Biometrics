import request from 'supertest';
import { randomUUID, createHmac } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import * as oauth from '../../src/health/oauth';
import * as subscriber from '../../src/health/subscriber';
import * as queue from '../../src/sync/queue';

jest.mock('../../src/health/oauth');
jest.mock('../../src/health/subscriber');
// A bare `jest.mock('../../src/sync/queue')` (or a factory that calls
// `jest.requireActual`) still loads the real module once to build the mock's
// shape, which runs its top-level `new IORedis(...)` as a side effect and
// leaves a real socket open that keeps Jest from exiting (same root cause
// flagged in Task 10's report and avoided in this file).
// Supplying a factory with an in-memory stand-in for `connection` avoids ever
// loading the real module.
jest.mock('../../src/sync/queue', () => {
  const store = new Map<string, string>();
  return {
    enqueueFetchJob: jest.fn(),
    enqueueBackfillJob: jest.fn(),
    connection: {
      set: async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async (key: string) => (store.delete(key) ? 1 : 0),
      getdel: async (key: string) => {
        const value = store.get(key) ?? null;
        store.delete(key);
        return value;
      },
    },
  };
});

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  process.env.GOOGLE_HEALTH_WEBHOOK_SECRET = 'Bearer webhook-secret';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

afterAll(async () => {
  await prisma.$disconnect();
});

// The oauth module is automocked, so give the URL builder a real shape. Set in
// beforeEach so a jest.clearAllMocks() in any suite cannot strand it.
beforeEach(() => {
  (oauth.buildAuthorizeUrl as jest.Mock).mockImplementation(
    (state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
  );
});

async function getHealthOAuthState(userId: string): Promise<string> {
  const { accessToken } = await issueSessionTokens(userId);
  const res = await request(createApp())
    .get('/health/authorize')
    .set('Authorization', `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
  const state = new URL(res.body.url).searchParams.get('state');
  expect(state).toBeTruthy();
  return state!;
}

describe('GET /health/authorize', () => {
  it('requires auth and returns the Google authorize URL as JSON', async () => {
    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const { accessToken } = await issueSessionTokens(user.id);
    (oauth.buildAuthorizeUrl as jest.Mock).mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc');

    const res = await request(createApp()).get('/health/authorize').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://accounts.google.com/o/oauth2/v2/auth?state=abc');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).get('/health/authorize');
    expect(res.status).toBe(401);
  });
});

describe('GET /health/callback', () => {
  it('succeeds with NO Authorization header, using the state token instead', async () => {
    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const { accessToken } = await issueSessionTokens(user.id);
    (oauth.buildAuthorizeUrl as jest.Mock).mockImplementation((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`);

    const authorizeRes = await request(createApp()).get('/health/authorize').set('Authorization', `Bearer ${accessToken}`);
    const state = new URL(authorizeRes.body.url).searchParams.get('state')!;

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'health-access', refreshToken: 'health-refresh', expiresIn: 3599,
    });
    const healthUserId = `health-user-1-${randomUUID()}`;
    (subscriber.getIdentity as jest.Mock).mockResolvedValue({ healthUserId });
    (subscriber.registerUserSubscription as jest.Mock).mockResolvedValue('sub-1');

    const res = await request(createApp()).get('/health/callback').query({ code: 'auth-code', state });

    expect(res.status).toBe(302);
    const conn = await prisma.healthConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('CONNECTED');
    expect(conn?.healthUserId).toBe(healthUserId);
    expect(conn?.webhookSubscriptionId).toBe('sub-1');
  });

  it('rejects a missing or unknown state token', async () => {
    const res = await request(createApp()).get('/health/callback').query({ code: 'auth-code', state: 'unknown-state' });
    expect(res.status).toBe(401);
  });

  it('rejects a replayed state token, because state is single-use', async () => {
    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getHealthOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'health-access-replay', refreshToken: 'health-refresh-replay', expiresIn: 3599,
    });
    (subscriber.getIdentity as jest.Mock).mockResolvedValue({ healthUserId: `health-user-replay-${randomUUID()}` });
    (subscriber.registerUserSubscription as jest.Mock).mockResolvedValue('sub-replay');

    const first = await request(createApp()).get('/health/callback').query({ code: 'c1', state });
    expect(first.status).toBe(302);

    const replay = await request(createApp()).get('/health/callback').query({ code: 'c2', state });
    expect(replay.status).toBe(401);
  });

  it('does not leave the connection CONNECTED when subscription registration fails', async () => {
    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getHealthOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'health-access-subfail', refreshToken: 'health-refresh-subfail', expiresIn: 3599,
    });
    (subscriber.getIdentity as jest.Mock).mockResolvedValue({ healthUserId: `health-user-subfail-${randomUUID()}` });
    (subscriber.registerUserSubscription as jest.Mock).mockRejectedValueOnce(
      new Error('Google Health subscription registration failed'),
    );

    const res = await request(createApp()).get('/health/callback').query({ code: 'code', state });

    expect(res.status).toBe(500);
    // The row must never exist claiming to be healthy with a subscription that
    // was never actually created at Google.
    expect(await prisma.healthConnection.findUnique({ where: { userId: user.id } })).toBeNull();
  });
});

describe('GET /webhooks/health', () => {
  it('returns 204 (no verification-challenge handshake needed for this provider)', async () => {
    // Google's subscriber verification is handled entirely by the automated
    // handshake during subscriber creation (see scripts/registerHealthSubscriber.ts),
    // not a per-request GET challenge like some other providers use — this route exists only
    // in case Google ever sends a GET here, and returns a harmless 204.
    const res = await request(createApp()).get('/webhooks/health');
    expect(res.status).toBe(204);
  });
});

describe('POST /webhooks/health', () => {
  it('rejects a request with a bad or missing Authorization header', async () => {
    const res = await request(createApp())
      .post('/webhooks/health')
      .send([{ data: { healthUserId: 'health-user-1', dataType: 'steps', operation: 'UPSERT', intervals: [] } }]);
    expect(res.status).toBe(401);
    expect(queue.enqueueFetchJob).not.toHaveBeenCalled();
  });

  it('enqueues a fetch job for a valid UPSERT notification', async () => {
    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const healthUserId = `health-user-2-${randomUUID()}`;
    await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId,
        encryptedAccessToken: 'x',
        encryptedRefreshToken: 'x',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const body = JSON.stringify([
      {
        data: {
          healthUserId,
          dataType: 'steps',
          operation: 'UPSERT',
          intervals: [{ physicalTimeInterval: { startTime: '2026-09-16T00:00:00Z', endTime: '2026-09-16T00:05:00Z' } }],
        },
      },
    ]);

    const res = await request(createApp())
      .post('/webhooks/health')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer webhook-secret')
      .send(body);

    expect(res.status).toBe(204);
    expect(queue.enqueueFetchJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id, metricType: 'STEPS', date: '2026-09-16' }),
    );
  });

  it('skips a non-UPSERT operation without enqueuing or erroring', async () => {
    (queue.enqueueFetchJob as jest.Mock).mockClear();

    const user = await prisma.user.create({
      data: { email: `h-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const healthUserId = `health-user-delete-${randomUUID()}`;
    await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId,
        encryptedAccessToken: 'x',
        encryptedRefreshToken: 'x',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const body = JSON.stringify([
      {
        data: {
          healthUserId,
          dataType: 'steps',
          operation: 'DELETE',
          intervals: [{ physicalTimeInterval: { startTime: '2026-09-16T00:00:00Z', endTime: '2026-09-16T00:05:00Z' } }],
        },
      },
    ]);

    const res = await request(createApp())
      .post('/webhooks/health')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer webhook-secret')
      .send(body);

    // Conservative: skip any non-UPSERT operation rather than treat it as an
    // error, per the spec's note that DELETE was never observed live.
    expect(res.status).toBe(204);
    expect(queue.enqueueFetchJob).not.toHaveBeenCalled();
  });
});
