import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser, pairUp, RecordingQueue } from '../buddies/helpers';
import { setBuddyNotifyQueue } from '../../src/buddies/notifyQueue';
import { evaluateAchievements } from '../../src/achievements/evaluate';
import { cosmeticsHooks } from '../../src/cosmetics/unlock';
import { seedNights } from '../recap/helpers';
import { day, sticker, unlocked, weekRecaps } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => {
  quiet = jest.spyOn(console, 'info').mockImplementation(() => {});
  setBuddyNotifyQueue(new RecordingQueue());
});
afterEach(() => quiet.mockRestore());

const NOW = new Date('2026-10-10T12:00:00Z');

async function startedUser() {
  const user = await buddyUser();
  await prisma.user.update({ where: { id: user.id }, data: { achievementsSince: day('2026-10-01') } });
  return user;
}

it('a new badge level calls the grant once, through EvaluateOptions, and not when nothing new is stored', async () => {
  const user = await startedUser();
  await seedNights(user.id, '2026-10-01', [500, 500, 500]);
  const grant = jest.fn(async (_userId: string, _now: Date) => undefined);
  await evaluateAchievements(user.id, NOW, undefined, { grantCosmetics: grant, announce: async () => undefined });
  expect(grant.mock.calls).toEqual([[user.id, NOW]]);
  await evaluateAchievements(user.id, NOW, undefined, { grantCosmetics: grant, announce: async () => undefined });
  expect(grant).toHaveBeenCalledTimes(1);
});

it('by default a new badge level grants its pieces', async () => {
  const user = await startedUser();
  await seedNights(user.id, '2026-10-01', [500, 500, 500]);
  await evaluateAchievements(user.id, NOW, undefined, { announce: async () => undefined });
  expect((await unlocked(user.id)).map((r) => r.itemId)).toEqual(['art.mountain', 'floor.carpet', 'item.bottle', 'plant.monstera', 'rug.red', 'shelf.trophyB']);
});

it('opening a 4th weekly recap grants the 4-recap pieces; opening it again grants nothing', async () => {
  const user = await buddyUser();
  await weekRecaps(user.id, 3, new Date('2026-10-16T00:00:00Z'));
  const fourth = await prisma.recap.create({
    data: { userId: user.id, kind: 'WEEK', periodStart: day('2026-09-07'), periodEnd: day('2026-09-13'), status: 'BUILT', sleepGoalMinutes: 480 },
  });
  const headers = await authHeaderFor(user.id);
  expect((await (await api()).post(`/me/recaps/${fourth.id}/opened`).set(headers)).status).toBe(204);
  expect((await unlocked(user.id)).map((r) => r.itemId)).toContain('wall.panel');
  const spy = jest.spyOn(cosmeticsHooks, 'grant');
  expect((await (await api()).post(`/me/recaps/${fourth.id}/opened`).set(headers)).status).toBe(204);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('the recap hook running before the first GET still stores pre-launch badges as backfill', async () => {
  const user = await buddyUser();
  await prisma.achievement.create({
    data: { userId: user.id, family: 'CHECK_IN', level: 1, value: 7, earnedOn: day('2026-09-01'), weekStart: day('2026-08-31'), monthStart: day('2026-09-01'), createdAt: new Date('2026-09-01T00:00:00Z') },
  });
  const recap = await prisma.recap.create({
    data: { userId: user.id, kind: 'WEEK', periodStart: day('2026-09-07'), periodEnd: day('2026-09-13'), status: 'BUILT', sleepGoalMinutes: 480 },
  });
  await (await api()).post(`/me/recaps/${recap.id}/opened`).set(await authHeaderFor(user.id));
  expect((await unlocked(user.id)).find((r) => r.itemId === 'pet.bed')).toEqual({ itemId: 'pet.bed', source: 'backfill' });
});

it('the 5th cheer grants the 5-cheer pieces, from the sticker route', async () => {
  const me = await buddyUser();
  const friends = await Promise.all([1, 2, 3, 4, 5].map(() => buddyUser()));
  for (const f of friends) await pairUp(me.id, f.id);
  for (const f of friends.slice(0, 4)) await sticker(me.id, f.id, new Date(Date.now() - 60_000));
  const res = await (await api()).post(`/me/buddies/${friends[4]!.id}/stickers`).set(await authHeaderFor(me.id)).send({ kind: 'CHEER' });
  expect(res.status).toBe(201);
  expect((await unlocked(me.id)).map((r) => r.itemId)).toEqual(expect.arrayContaining(['out.party', 'plant.sunflower', 'wall.florals', 'win.fairy']));
});

it('a failed grant never fails the sticker send or the recap open', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const real = cosmeticsHooks.grant;
  cosmeticsHooks.grant = async () => { throw new Error('db down'); };
  try {
    const me = await buddyUser();
    const friend = await buddyUser();
    await pairUp(me.id, friend.id);
    const headers = await authHeaderFor(me.id);
    expect((await (await api()).post(`/me/buddies/${friend.id}/stickers`).set(headers).send({ kind: 'CHEER' })).status).toBe(201);
    const recap = await prisma.recap.create({
      data: { userId: me.id, kind: 'WEEK', periodStart: day('2026-09-07'), periodEnd: day('2026-09-13'), status: 'BUILT', sleepGoalMinutes: 480 },
    });
    expect((await (await api()).post(`/me/recaps/${recap.id}/opened`).set(headers)).status).toBe(204);
    expect(warn.mock.calls.map((c) => String(c[0])).join()).not.toContain(me.id);
  } finally {
    cosmeticsHooks.grant = real;
    warn.mockRestore();
  }
});
