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
// The OAuth state store is backed by the Redis `connection` exported from the
// same module, so the factory supplies an in-memory stand-in. The store is kept
// inside the factory because jest hoists this call above module scope.
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
  process.env.FITBIT_VERIFY_CODE = 'verify-me';
  process.env.FITBIT_CLIENT_SECRET = 'client-secret';
  process.env.FITBIT_CLIENT_ID = 'client-id';
  process.env.FITBIT_REDIRECT_URI = 'https://app.example.com/fitbit/callback';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

// The oauth module is automocked, so give the URL builder a real shape. Set in
// beforeEach so a jest.clearAllMocks() in any suite cannot strand it.
beforeEach(() => {
  (oauth.buildAuthorizeUrl as jest.Mock).mockImplementation(
    (state: string) => `https://www.fitbit.com/oauth2/authorize?client_id=client-id&state=${state}`,
  );
});

/**
 * Drives the real authenticated /fitbit/authorize endpoint and pulls the state
 * token out of the returned URL, exactly as the mobile app would.
 */
async function getOAuthState(userId: string): Promise<string> {
  const { accessToken } = await issueSessionTokens(userId);
  const res = await request(createApp())
    .get('/fitbit/authorize')
    .set('Authorization', `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
  const state = new URL(res.body.url).searchParams.get('state');
  expect(state).toBeTruthy();
  return state!;
}

afterAll(async () => {
  await prisma.$disconnect();
});

function signBody(body: string): string {
  return createHmac('sha1', process.env.FITBIT_CLIENT_SECRET!).update(body).digest('base64');
}

async function createConnectedUser() {
  const user = await prisma.user.create({
    data: { email: `wh-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
  });
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

describe('GET /fitbit/authorize', () => {
  it('returns the Fitbit authorize URL with a state token for an authenticated user', async () => {
    const user = await prisma.user.create({
      data: { email: `az-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .get('/fitbit/authorize')
      .set('Authorization', `Bearer ${accessToken}`);

    // JSON, not a redirect: the system browser cannot send our bearer token, so
    // the app has to fetch this URL over the authenticated API first.
    expect(res.status).toBe(200);
    expect(typeof res.body.url).toBe('string');
    expect(new URL(res.body.url).searchParams.get('state')).toBeTruthy();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).get('/fitbit/authorize');
    expect(res.status).toBe(401);
  });
});

describe('GET /fitbit/callback', () => {
  it('exchanges the code, stores the connection, registers a subscription, and enqueues a backfill', async () => {
    const user = await prisma.user.create({
      data: { email: `f-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access',
      refreshToken: 'fitbit-refresh',
      expiresIn: 28800,
      fitbitUserId: `fitbit-user-1-${randomUUID()}`,
    });

    // No Authorization header anywhere: this is how Fitbit actually calls us.
    const res = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code', state });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('biometrics://fitbit/callback?status=connected');
    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('CONNECTED');
    expect(subscription.registerWebhookSubscription).toHaveBeenCalled();
    expect(queue.enqueueBackfillJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
  });

  // The regression test for the original bug: every previous callback test
  // attached a bearer token that no real client (Fitbit's redirect) can send,
  // which is exactly why they all passed while the flow was broken in practice.
  it('succeeds with no Authorization header at all', async () => {
    const user = await prisma.user.create({
      data: { email: `noauth-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access-noauth',
      refreshToken: 'fitbit-refresh-noauth',
      expiresIn: 28800,
      fitbitUserId: `fitbit-user-noauth-${randomUUID()}`,
    });

    const res = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code-noauth', state });

    expect(res.status).toBe(302);
    const conn = await prisma.fitbitConnection.findUnique({ where: { userId: user.id } });
    expect(conn?.status).toBe('CONNECTED');
  });

  it('resolves the user from the state token, not from any session', async () => {
    const stateOwner = await prisma.user.create({
      data: { email: `owner-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const bystander = await prisma.user.create({
      data: { email: `bystander-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(stateOwner.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access-state',
      refreshToken: 'fitbit-refresh-state',
      expiresIn: 28800,
      fitbitUserId: `fitbit-user-state-${randomUUID()}`,
    });

    await request(createApp()).get('/fitbit/callback').query({ code: 'code', state });

    expect(await prisma.fitbitConnection.findUnique({ where: { userId: stateOwner.id } })).not.toBeNull();
    expect(await prisma.fitbitConnection.findUnique({ where: { userId: bystander.id } })).toBeNull();
  });

  it('rejects a callback with a missing state', async () => {
    const res = await request(createApp()).get('/fitbit/callback').query({ code: 'auth-code' });
    expect(res.status).toBe(400);
  });

  it('rejects a callback with an unknown or expired state', async () => {
    const res = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code', state: randomUUID() });
    expect(res.status).toBe(401);
  });

  it('rejects a replayed state token, because state is single-use', async () => {
    const user = await prisma.user.create({
      data: { email: `replay-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access-replay',
      refreshToken: 'fitbit-refresh-replay',
      expiresIn: 28800,
      fitbitUserId: `fitbit-user-replay-${randomUUID()}`,
    });

    const first = await request(createApp()).get('/fitbit/callback').query({ code: 'c1', state });
    expect(first.status).toBe(302);

    const replay = await request(createApp()).get('/fitbit/callback').query({ code: 'c2', state });
    expect(replay.status).toBe(401);
  });

  it('does not leave the connection CONNECTED when subscription registration fails', async () => {
    const user = await prisma.user.create({
      data: { email: `subfail-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(user.id);

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access-subfail',
      refreshToken: 'fitbit-refresh-subfail',
      expiresIn: 28800,
      fitbitUserId: `fitbit-user-subfail-${randomUUID()}`,
    });
    (subscription.registerWebhookSubscription as jest.Mock).mockRejectedValueOnce(
      new Error('Fitbit subscription registration failed'),
    );

    const res = await request(createApp()).get('/fitbit/callback').query({ code: 'code', state });

    expect(res.status).toBe(500);
    // The row must never exist claiming to be healthy with a subscription that
    // was never actually created at Fitbit.
    expect(await prisma.fitbitConnection.findUnique({ where: { userId: user.id } })).toBeNull();
  });

  it('scopes the backfill to the gap since last sync on reconnect', async () => {
    const user = await prisma.user.create({
      data: { email: `r-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const state = await getOAuthState(user.id);
    const lastSyncedAt = new Date('2026-08-15T00:00:00.000Z');
    const fitbitUserId = `fitbit-user-2-${randomUUID()}`;

    await prisma.fitbitConnection.create({
      data: {
        userId: user.id,
        fitbitUserId,
        encryptedAccessToken: 'placeholder',
        encryptedRefreshToken: 'placeholder',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        status: 'DISCONNECTED',
        lastSyncedAt,
      },
    });

    (oauth.exchangeCodeForTokens as jest.Mock).mockResolvedValue({
      accessToken: 'fitbit-access-2',
      refreshToken: 'fitbit-refresh-2',
      expiresIn: 28800,
      fitbitUserId,
    });

    const res = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code-2', state });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('biometrics://fitbit/callback?status=connected');
    expect(queue.enqueueBackfillJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id, startDate: '2026-08-15' }),
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

  // HRV is sleep-derived at Fitbit, so a sleep notification must also trigger
  // an HRV fetch; otherwise HRV only ever arrives via the 30-day backfill.
  it('fetches HRV on a sleep notification as well as on an activities one', async () => {
    const { user, fitbitUserId } = await createConnectedUser();
    const body = JSON.stringify([{ collectionType: 'sleep', date: '2026-09-03', ownerId: fitbitUserId }]);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signBody(body))
      .send(body);

    expect(res.status).toBe(204);
    expect(queue.enqueueFetchJob).toHaveBeenCalledWith({
      userId: user.id,
      metricType: 'HRV',
      date: '2026-09-03',
    });
  });

  it('fetches resting HR, steps and HRV on an activities notification', async () => {
    const { user, fitbitUserId } = await createConnectedUser();
    const body = JSON.stringify([{ collectionType: 'activities', date: '2026-09-04', ownerId: fitbitUserId }]);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signBody(body))
      .send(body);

    expect(res.status).toBe(204);
    for (const metricType of ['RESTING_HR', 'STEPS', 'HRV']) {
      expect(queue.enqueueFetchJob).toHaveBeenCalledWith({
        userId: user.id,
        metricType,
        date: '2026-09-04',
      });
    }
  });

  it('ignores a notification for a Fitbit account with no connection', async () => {
    const body = JSON.stringify([
      { collectionType: 'sleep', date: '2026-09-05', ownerId: `unknown-${randomUUID()}` },
    ]);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signBody(body))
      .send(body);

    expect(res.status).toBe(204);
    expect(queue.enqueueFetchJob).not.toHaveBeenCalled();
  });

  it('ignores a userRevokedAccess notification for an unknown Fitbit account', async () => {
    const body = JSON.stringify([
      { collectionType: 'userRevokedAccess', date: '2026-09-05', ownerId: `unknown-${randomUUID()}` },
    ]);

    const res = await request(createApp())
      .post('/webhooks/fitbit')
      .set('Content-Type', 'application/json')
      .set('x-fitbit-signature', signBody(body))
      .send(body);

    expect(res.status).toBe(204);
  });
});
