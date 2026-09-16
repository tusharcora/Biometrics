import request from 'supertest';
import { randomUUID } from 'crypto';
import nock from 'nock';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { processSyncJob } from '../../src/sync/worker';
import * as queue from '../../src/sync/queue';
import * as serviceAccount from '../../src/health/serviceAccount';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
  process.env.GOOGLE_HEALTH_CLIENT_ID = 'client-id.apps.googleusercontent.com';
  process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_HEALTH_REDIRECT_URI = 'https://app.example.com/health/callback';
  process.env.GOOGLE_CLOUD_PROJECT_NUMBER = '92059865078';
});

afterEach(() => nock.cleanAll());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('connect Google Health and sync end to end (mocked Google API)', () => {
  it('connects, backfills, and serves data via /me/biometrics', async () => {
    const user = await prisma.user.create({
      data: { email: `e2e-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const authorizeRes = await request(createApp()).get('/health/authorize').set('Authorization', `Bearer ${accessToken}`);
    const state = new URL(authorizeRes.body.url).searchParams.get('state')!;

    nock('https://oauth2.googleapis.com').post('/token').reply(200, {
      access_token: 'health-access', refresh_token: 'health-refresh', expires_in: 3599,
    });
    // Suffixed with a fresh UUID, like the prior version of this test's analogous
    // user id, so repeat runs against a persistent test DB don't collide on
    // HealthConnection.healthUserId's unique constraint.
    const healthUserId = `health-user-e2e-${randomUUID()}`;
    nock('https://health.googleapis.com').get('/v4/users/me/identity').reply(200, {
      name: 'users/me/identity', legacyUserId: 'DCB3ZG', healthUserId,
    });
    nock('https://health.googleapis.com')
      .post('/v4/projects/92059865078/subscribers/biometrics-subscriber/subscriptions')
      .reply(200, { name: 'projects/92059865078/subscribers/biometrics-subscriber/subscriptions/sub-e2e' });

    // registerUserSubscription authenticates to Google as a service account via
    // google-auth-library's Application Default Credentials machinery
    // (GoogleAuth -> gtoken -> gaxios), which internally performs a dynamic
    // `import('node-fetch')` to make its HTTP calls. That dynamic import throws
    // (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG) inside Jest's CommonJS VM
    // sandbox, which has no importModuleDynamically callback registered -- a
    // Jest/Node tooling limitation, not an application bug, and the same
    // boundary Task 9's own unit tests (tests/health/subscriber.test.ts) mock
    // for exactly this reason. Every HTTP call this application's own code
    // makes directly (OAuth exchange, identity, subscription creation,
    // backfill fetches) still goes through real fetch calls intercepted by
    // nock below.
    jest.spyOn(serviceAccount, 'getServiceAccountToken').mockResolvedValue('service-account-access');

    let enqueuedBackfill: any;
    jest.spyOn(queue, 'enqueueBackfillJob').mockImplementation(async (data) => {
      enqueuedBackfill = data;
      return {} as any;
    });

    const connectRes = await request(createApp()).get('/health/callback').query({ code: 'auth-code', state });
    expect(connectRes.status).toBe(302);

    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp')
      .reply(200, {
        rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 9, day: 1 } }, steps: { countSum: '7000' } }],
      });
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp')
      .reply(200, {
        rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 9, day: 1 } }, heartRate: { beatsPerMinuteMin: 55 } }],
      });
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, {
        dataPoints: [{ sleep: { interval: { startTime: '2026-09-01T22:00:00Z' }, summary: { minutesAsleep: 400 } } }],
      });
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/heartRateVariability/dataPoints')
      .query(true)
      .reply(200, {
        dataPoints: [{ heartRateVariability: { sampleTime: { physicalTime: '2026-09-01T23:00:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 40 } }],
      });

    await processSyncJob({ name: 'backfill', data: enqueuedBackfill } as any);

    const res = await request(createApp()).get('/me/biometrics').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });
});
