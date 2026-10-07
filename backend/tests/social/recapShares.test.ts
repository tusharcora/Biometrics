import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { shiftDate } from '../../src/scoring/dates';
import { api, buddyUser } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

async function recap(userId: string, opts: { status?: 'BUILT' | 'SKIPPED'; start?: string; line?: string | null } = {}) {
  const start = opts.start ?? '2026-09-28';
  return prisma.recap.create({
    data: {
      userId, kind: 'WEEK', periodStart: civilDateToUtcMidnight(start), periodEnd: civilDateToUtcMidnight(shiftDate(start, 6)),
      status: opts.status ?? 'BUILT', sleepGoalMinutes: 480,
      line: opts.line === undefined ? 'You slept 7h 12m a night on average.' : opts.line, lineSource: 'TEMPLATE',
    },
  });
}

it('shares only your own built recap with a line, idempotently, reports it, and unshares', async () => {
  const me = await buddyUser();
  const other = await buddyUser();
  const mine = await recap(me.id);
  const theirs = await recap(other.id);
  const skipped = await recap(me.id, { status: 'SKIPPED', start: '2026-09-21' });
  const noLine = await recap(me.id, { start: '2026-09-14', line: null });
  const agent = await api();
  const headers = await authHeaderFor(me.id);
  const before = await agent.get(`/me/social/recap-shares/${mine.id}`).set(headers);
  expect([before.status, before.body, before.headers['cache-control']]).toEqual([200, { shared: false }, 'private, no-store']);
  expect((await agent.post('/me/social/recap-shares').set(headers).send({ recapId: mine.id })).body).toEqual({ shared: true });
  expect((await agent.post('/me/social/recap-shares').set(headers).send({ recapId: mine.id })).body).toEqual({ shared: true });
  expect(await prisma.recapShare.count({ where: { sharerId: me.id } })).toBe(1);
  expect((await agent.get(`/me/social/recap-shares/${mine.id}`).set(headers)).body).toEqual({ shared: true });
  // The share is consent for the line exactly as previewed; a recap without a line has nothing to share.
  for (const id of [theirs.id, skipped.id, noLine.id, 'not-a-uuid']) {
    const res = await agent.post('/me/social/recap-shares').set(headers).send({ recapId: id });
    expect([res.status, res.body]).toEqual([404, { error: 'recap_not_found' }]);
  }
  expect((await agent.get('/me/social/recap-shares/not-a-uuid').set(headers)).body).toEqual({ shared: false });
  expect((await agent.get(`/me/social/recap-shares/${theirs.id}`).set(headers)).body).toEqual({ shared: false });
  expect((await agent.delete(`/me/social/recap-shares/${mine.id}`).set(headers)).status).toBe(204);
  expect(await prisma.recapShare.count({ where: { sharerId: me.id } })).toBe(0);
  expect((await agent.get(`/me/social/recap-shares/${mine.id}`).set(headers)).body).toEqual({ shared: false });
});
