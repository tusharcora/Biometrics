import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

async function createUser(prefix: string) {
  return prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@example.com`,
      authProvider: 'GOOGLE',
      providerUserId: randomUUID(),
    },
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /me/biometrics', () => {
  it('returns the current user\'s biometric records', async () => {
    const user = await prisma.user.create({ data: { email: `b-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    await prisma.biometricRecord.create({
      data: { userId: user.id, metricType: 'STEPS', value: 9000, recordedAt: new Date('2026-09-01') },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp()).get('/me/biometrics').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].value).toBe(9000);
  });

  it('returns only the fields the dashboard consumes', async () => {
    const user = await createUser('fields');
    await prisma.biometricRecord.create({
      data: { userId: user.id, metricType: 'HRV', value: 42, recordedAt: new Date('2026-09-03') },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .get('/me/biometrics')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    // Internal columns must not leak to the client.
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'metricType', 'recordedAt', 'value']);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).get('/me/biometrics');
    expect(res.status).toBe(401);
  });

  it('does not return another user\'s biometric records', async () => {
    const userA = await prisma.user.create({ data: { email: `a-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    const userB = await prisma.user.create({ data: { email: `c-${Date.now()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() } });
    await prisma.biometricRecord.create({
      data: { userId: userA.id, metricType: 'STEPS', value: 1234, recordedAt: new Date('2026-09-02') },
    });
    await prisma.biometricRecord.create({
      data: { userId: userB.id, metricType: 'STEPS', value: 5678, recordedAt: new Date('2026-09-02') },
    });
    const { accessToken } = await issueSessionTokens(userA.id);

    const res = await request(createApp()).get('/me/biometrics').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].value).toBe(1234);
  });
});

describe('GET /me/activity', () => {
  async function seedSteps(userId: string, entries: [string, number][]) {
    for (const [date, value] of entries) {
      await prisma.biometricRecord.create({
        data: { userId, metricType: 'STEPS', value, recordedAt: new Date(`${date}T00:00:00Z`) },
      });
    }
  }

  async function getActivity(userId: string, query: Record<string, string>) {
    const { accessToken } = await issueSessionTokens(userId);
    return request(createApp()).get('/me/activity').query(query).set('Authorization', `Bearer ${accessToken}`);
  }

  it('returns daily steps within the inclusive range, oldest first, keyed by civil date', async () => {
    const user = await createUser('act-range');
    await seedSteps(user.id, [
      ['2026-08-31', 100],
      ['2026-09-02', 12000],
      ['2026-09-01', 0],
      ['2026-09-03', 5000],
      ['2026-09-04', 999],
    ]);

    const res = await getActivity(user.id, { from: '2026-09-01', to: '2026-09-03' });

    expect(res.status).toBe(200);
    expect(res.body.days).toEqual([
      { date: '2026-09-01', steps: 0 },
      { date: '2026-09-02', steps: 12000 },
      { date: '2026-09-03', steps: 5000 },
    ]);
  });

  it('reports the oldest STEPS record as earliestDate, even outside the range', async () => {
    const user = await createUser('act-earliest');
    await seedSteps(user.id, [['2026-01-15', 3000], ['2026-09-02', 8000]]);
    // Other metrics do not count as steps history.
    await prisma.biometricRecord.create({
      data: { userId: user.id, metricType: 'HRV', value: 40, recordedAt: new Date('2025-12-01T00:00:00Z') },
    });

    const res = await getActivity(user.id, { from: '2026-09-01', to: '2026-09-30' });

    expect(res.body.earliestDate).toBe('2026-01-15');
    expect(res.body.days).toEqual([{ date: '2026-09-02', steps: 8000 }]);
  });

  it('returns no days and a null earliestDate when there is no steps history', async () => {
    const user = await createUser('act-empty');

    const res = await getActivity(user.id, { from: '2026-09-01', to: '2026-09-30' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ days: [], earliestDate: null });
  });

  it('accepts a single-day range and a 400-day range', async () => {
    const user = await createUser('act-bounds');
    await seedSteps(user.id, [['2026-09-01', 42]]);

    const single = await getActivity(user.id, { from: '2026-09-01', to: '2026-09-01' });
    // 2025-08-28 .. 2026-10-01 inclusive is exactly 400 days.
    const widest = await getActivity(user.id, { from: '2025-08-28', to: '2026-10-01' });

    expect(single.status).toBe(200);
    expect(single.body.days).toEqual([{ date: '2026-09-01', steps: 42 }]);
    expect(widest.status).toBe(200);
  });

  it.each([
    ['missing dates', {}],
    ['a missing to', { from: '2026-09-01' }],
    ['a malformed date', { from: '2026-9-1', to: '2026-09-30' }],
    ['an impossible date', { from: '2026-02-30', to: '2026-03-10' }],
    ['from after to', { from: '2026-09-10', to: '2026-09-01' }],
    ['a range over 400 days', { from: '2025-08-27', to: '2026-10-01' }],
  ])('rejects %s with a 400', async (_label, query) => {
    const user = await createUser('act-invalid');

    const res = await getActivity(user.id, query as Record<string, string>);

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).get('/me/activity').query({ from: '2026-09-01', to: '2026-09-02' });
    expect(res.status).toBe(401);
  });

  it("does not return another user's steps", async () => {
    const me = await createUser('act-me');
    const other = await createUser('act-other');
    await seedSteps(other.id, [['2026-09-01', 7777]]);

    const res = await getActivity(me.id, { from: '2026-09-01', to: '2026-09-01' });

    expect(res.body).toEqual({ days: [], earliestDate: null });
  });
});

describe('GET /me/connection', () => {
  it('reports NOT_CONNECTED when the user has never connected a health account', async () => {
    const user = await createUser('nc');
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .get('/me/connection')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'NOT_CONNECTED', lastSyncedAt: null });
  });

  it('reports CONNECTED with the last sync time', async () => {
    const user = await createUser('conn');
    await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId: `health-conn-${randomUUID()}`,
        encryptedAccessToken: 'placeholder',
        encryptedRefreshToken: 'placeholder',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        status: 'CONNECTED',
        lastSyncedAt: new Date('2026-09-10T08:30:00.000Z'),
      },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .get('/me/connection')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'CONNECTED',
      lastSyncedAt: '2026-09-10T08:30:00.000Z',
    });
  });

  it('reports DISCONNECTED so the client can prompt a reconnect', async () => {
    const user = await createUser('disc');
    await prisma.healthConnection.create({
      data: {
        userId: user.id,
        healthUserId: `health-disc-${randomUUID()}`,
        encryptedAccessToken: 'placeholder',
        encryptedRefreshToken: 'placeholder',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        status: 'DISCONNECTED',
      },
    });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .get('/me/connection')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISCONNECTED');
    expect(res.body.lastSyncedAt).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).get('/me/connection');
    expect(res.status).toBe(401);
  });

  it("does not leak another user's connection", async () => {
    const userA = await createUser('leakA');
    const userB = await createUser('leakB');
    await prisma.healthConnection.create({
      data: {
        userId: userB.id,
        healthUserId: `health-leak-${randomUUID()}`,
        encryptedAccessToken: 'placeholder',
        encryptedRefreshToken: 'placeholder',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        status: 'CONNECTED',
      },
    });
    const { accessToken } = await issueSessionTokens(userA.id);

    const res = await request(createApp())
      .get('/me/connection')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.status).toBe('NOT_CONNECTED');
  });
});
