import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { storeSleepSessions } from '../../src/biometrics/repository';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser() {
  return prisma.user.create({
    data: { email: `tz-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID() },
  });
}

describe('PUT /me/timezone', () => {
  it('defaults a new user to UTC', async () => {
    const user = await createUser();
    expect(user.timezone).toBe('UTC');
  });

  it('stores a valid IANA zone and echoes it back', async () => {
    const user = await createUser();
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .put('/me/timezone')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ timezone: 'America/Los_Angeles' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: 'America/Los_Angeles' });
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.timezone).toBe('America/Los_Angeles');
  });

  it.each([
    ['an unknown zone', { timezone: 'Mars/Olympus_Mons' }],
    ['an empty string', { timezone: '' }],
    ['a UTC offset, which is not an IANA name', { timezone: '+05:00' }],
    ['a non-string', { timezone: 42 }],
    ['a missing field', {}],
  ])('rejects %s with 400 and leaves the stored zone alone', async (_label, body) => {
    const user = await createUser();
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp()).put('/me/timezone').set('Authorization', `Bearer ${accessToken}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.timezone).toBe('UTC');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(createApp()).put('/me/timezone').send({ timezone: 'UTC' });
    expect(res.status).toBe(401);
  });

  it('recomputes the SLEEP rollups when the timezone changes', async () => {
    const user = await createUser();
    // Ends 05:30Z Sep 3: UTC date Sep 3, Los Angeles date Sep 2.
    await storeSleepSessions(user.id, [
      { startTime: new Date('2026-09-02T20:00:00Z'), endTime: new Date('2026-09-03T05:30:00Z'), minutesAsleep: 500 },
    ]);
    const dates = async () =>
      (await prisma.biometricRecord.findMany({ where: { userId: user.id, metricType: 'SLEEP' } })).map((r) =>
        r.recordedAt.toISOString().slice(0, 10),
      );
    expect(await dates()).toEqual(['2026-09-03']);
    const { accessToken } = await issueSessionTokens(user.id);

    await request(createApp())
      .put('/me/timezone')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ timezone: 'America/Los_Angeles' })
      .expect(200);

    expect(await dates()).toEqual(['2026-09-02']);
  });

  it('leaves sessions that carry their own UTC offset where the offset puts them, moving only the rest', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [
      // No offset: follows the zone (UTC Sep 3, Los Angeles Sep 2).
      { startTime: new Date('2026-09-02T20:00:00Z'), endTime: new Date('2026-09-03T05:30:00Z'), minutesAsleep: 500 },
      // Offset +09:00: ends 22:00Z Sep 5 = Sep 6 local, whatever the zone is.
      {
        startTime: new Date('2026-09-05T14:00:00Z'),
        endTime: new Date('2026-09-05T22:00:00Z'),
        minutesAsleep: 430,
        startUtcOffsetSeconds: 32400,
        endUtcOffsetSeconds: 32400,
      },
    ]);
    const { accessToken } = await issueSessionTokens(user.id);

    await request(createApp())
      .put('/me/timezone')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ timezone: 'America/Los_Angeles' })
      .expect(200);

    const rows = await prisma.biometricRecord.findMany({
      where: { userId: user.id, metricType: 'SLEEP' },
      orderBy: { recordedAt: 'asc' },
    });
    expect(rows.map((r) => [r.recordedAt.toISOString().slice(0, 10), r.value])).toEqual([
      ['2026-09-02', 500],
      ['2026-09-06', 430],
    ]);
  });

  it('is idempotent: repeating the same PUT leaves the rollups unchanged (and repairs a half-finished one)', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [
      { startTime: new Date('2026-09-02T20:00:00Z'), endTime: new Date('2026-09-03T05:30:00Z'), minutesAsleep: 500 },
    ]);
    const { accessToken } = await issueSessionTokens(user.id);
    const put = () =>
      request(createApp()).put('/me/timezone').set('Authorization', `Bearer ${accessToken}`).send({ timezone: 'America/Los_Angeles' });

    await put().expect(200);
    await put().expect(200);

    const rows = await prisma.biometricRecord.findMany({ where: { userId: user.id, metricType: 'SLEEP' } });
    expect(rows.map((r) => [r.recordedAt.toISOString().slice(0, 10), r.value])).toEqual([['2026-09-02', 500]]);
  });
});
