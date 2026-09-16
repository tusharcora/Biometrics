import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

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
    expect(res.body.every((r: any) => r.userId === userA.id)).toBe(true);
  });
});
