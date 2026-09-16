import request from 'supertest';
import { randomUUID } from 'crypto';
import nock from 'nock';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { processSyncJob } from '../../src/sync/worker';
import * as queue from '../../src/sync/queue';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
  process.env.FITBIT_CLIENT_ID = 'client-id';
  process.env.FITBIT_CLIENT_SECRET = 'client-secret';
  process.env.FITBIT_REDIRECT_URI = 'https://app.example.com/fitbit/callback';
});

afterEach(() => nock.cleanAll());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('connect Fitbit and sync end to end (mocked Fitbit API)', () => {
  it('connects, backfills, and serves data via /me/biometrics', async () => {
    const user = await prisma.user.create({ data: { email: `e2e-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    const { accessToken } = await issueSessionTokens(user.id);

    nock('https://api.fitbit.com').post('/oauth2/token').reply(200, {
      access_token: 'fitbit-access',
      refresh_token: 'fitbit-refresh',
      expires_in: 28800,
      user_id: `fitbit-user-e2e-${randomUUID()}`,
    });
    nock('https://api.fitbit.com').post(/apiSubscriptions/).reply(201, {});

    let enqueuedBackfill: any;
    jest.spyOn(queue, 'enqueueBackfillJob').mockImplementation(async (data) => {
      enqueuedBackfill = data;
      return {} as any;
    });

    // Real flow: fetch the authorize URL over the authenticated API to mint a
    // state token, then hit the callback the way Fitbit does — unauthenticated.
    const authorizeRes = await request(createApp())
      .get('/fitbit/authorize')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(authorizeRes.status).toBe(200);
    const state = new URL(authorizeRes.body.url).searchParams.get('state');
    expect(state).toBeTruthy();

    const connectRes = await request(createApp())
      .get('/fitbit/callback')
      .query({ code: 'auth-code', state });
    expect(connectRes.status).toBe(302);

    nock('https://api.fitbit.com')
      .get(/activities\/heart\/date/)
      .reply(200, { 'activities-heart': [{ dateTime: '2026-09-01', value: { restingHeartRate: 55 } }] });
    nock('https://api.fitbit.com')
      .get(/activities\/steps\/date/)
      .reply(200, { 'activities-steps': [{ dateTime: '2026-09-01', value: '7000' }] });
    nock('https://api.fitbit.com')
      .get(/1\.2\/user\/-\/sleep\/date/)
      .reply(200, { sleep: [{ dateOfSleep: '2026-09-01', minutesAsleep: 400 }] });
    nock('https://api.fitbit.com')
      .get(/hrv\/date/)
      .reply(200, { hrv: [{ dateTime: '2026-09-01', value: { dailyRmssd: 40 } }] });

    await processSyncJob({ name: 'backfill', data: enqueuedBackfill } as any);

    const res = await request(createApp()).get('/me/biometrics').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });
});
