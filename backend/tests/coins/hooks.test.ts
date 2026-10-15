import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { cosmeticsHooks } from '../../src/cosmetics/unlock';
import { coinsConfig, coinsHooks, earnCoins } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { day, weekRecaps } from '../cosmetics/helpers';
import { balance, coinUser, rowsOf } from './helpers';

const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2026-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

it('an on-time check-in pays its 5 coins at once (spec §6.3 hooks)', async () => {
  const { user, headers } = await coinUser();
  expect((await (await api()).post('/me/habits/check-ins').set(headers).send({})).status).toBe(201);
  expect((await rowsOf(user.id)).filter((r) => r.kind === 'checkin').map((r) => r.amount)).toEqual([5]);
});

it('a failing earn never fails the check-in', async () => {
  const { headers } = await coinUser();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const spy = jest.spyOn(coinsHooks, 'earn').mockRejectedValue(new Error('down'));
  try {
    expect((await (await api()).post('/me/habits/check-ins').set(headers).send({})).status).toBe(201);
  } finally {
    spy.mockRestore();
    warn.mockRestore();
  }
});

it('opening a WEEK recap pays 10 and runs the cosmetics grant; a MONTH open runs neither (spec §6.2, §13, ruling 32)', async () => {
  const { user, headers } = await coinUser();
  const grant = jest.spyOn(cosmeticsHooks, 'grant');
  try {
    await weekRecaps(user.id, 1, null);
    await weekRecaps(user.id, 1, null, 'MONTH', 3);
    const week = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'WEEK' } });
    const month = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'MONTH' } });
    expect((await (await api()).post(`/me/recaps/${month.id}/opened`).set(headers)).status).toBe(204);
    expect([grant.mock.calls.length, await balance(user.id)]).toEqual([0, 0]);
    expect((await (await api()).post(`/me/recaps/${week.id}/opened`).set(headers)).status).toBe(204);
    expect([grant.mock.calls.length, (await rowsOf(user.id)).map((r) => [r.kind, r.sourceKey, r.amount])]).toEqual([1, [['recap', `recap:${week.id}`, 10]]]);
  } finally {
    grant.mockRestore();
  }
});

it('a GET catch-up racing two direct earns pays the check-in once (Review Focus 1)', async () => {
  const { user, headers } = await coinUser();
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(habitDayFor(new Date(), 'UTC')), onTime: true } });
  await Promise.all([(await api()).get('/me/coins').set(headers), earnCoins(user.id, new Date()), earnCoins(user.id, new Date())]);
  expect([(await rowsOf(user.id)).filter((r) => r.kind === 'checkin').length, await balance(user.id)]).toEqual([1, 5]);
});
