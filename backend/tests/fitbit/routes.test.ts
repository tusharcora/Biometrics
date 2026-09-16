import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
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
