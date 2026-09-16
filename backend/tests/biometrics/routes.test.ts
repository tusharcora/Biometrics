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
