// Counts every Prisma model operation through a query extension on the shared client. The factory only touches
// `mockQueries` when a query runs, after this file's top level has set it.
const mockQueries = { count: 0 };
jest.mock('../../src/db/client', () => {
  const { PrismaClient } = jest.requireActual('@prisma/client');
  const base = new PrismaClient();
  return {
    prisma: base.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
            mockQueries.count += 1;
            return query(args);
          },
        },
      },
    }),
  };
});

import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { shiftDate } from '../../src/scoring/dates';
import * as circle from '../../src/social/circle';
import * as checkins from '../../src/social/checkins';
import { getWeeklyHighlights } from '../../src/social/highlights';
import { getSocialHome } from '../../src/social/home';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  jest.restoreAllMocks();
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-07T20:00:00Z'); // Wednesday; last week Mon 2026-09-28 is final
const WEEK = '2026-09-28';
// Not tests/buddies/helpers: it loads the app and Better Auth, which should not run on the counting client.
const person = (name: string) =>
  prisma.user.create({
    data: { email: `q-${randomUUID()}@example.com`, name, handle: `q${randomUUID().replace(/-/g, '').slice(0, 12)}`, displayName: name, buddyMoodNoticeAt: new Date() },
  });
const pair = (a: string, b: string, createdAt = new Date()) =>
  prisma.buddyPair.create({ data: { ...(a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a }), createdAt } });

it('builds the whole home from one preloaded circle, in at most 16 queries, with one lock decision', async () => {
  const me = await person('Me');
  const sam = await person('Sam');
  const ana = await person('Ana');
  await pair(me.id, sam.id);
  await pair(me.id, ana.id);
  for (let i = 0; i < 7; i++) {
    await prisma.checkIn.create({ data: { authorId: ana.id, localDate: civilDateToUtcMidnight(shiftDate(WEEK, i)), mood: 'RESTED' } });
  }
  await prisma.checkIn.create({ data: { authorId: sam.id, localDate: civilDateToUtcMidnight('2026-10-07'), mood: 'TIRED', createdAt: new Date('2026-10-07T15:00:00Z') } });
  await getSocialHome(me.id, NOW); // the first read builds and caches last week's highlights

  const loads = jest.spyOn(circle, 'loadCircle');
  const rederived = [
    jest.spyOn(circle, 'buddyIdsOf'),
    jest.spyOn(circle, 'membersById'),
    jest.spyOn(checkins, 'todayFor'),
    jest.spyOn(checkins, 'getTodayCheckIn'),
  ];
  mockQueries.count = 0;
  const home = await getSocialHome(me.id, NOW);

  // S1 read ~26: loadCircle 4 + rings 3 + timeline 5 + cached highlights 1 + requests 2 + stickers 1.
  expect(mockQueries.count).toBeLessThanOrEqual(16);
  expect(loads).toHaveBeenCalledTimes(1);
  for (const spy of rederived) expect(spy).not.toHaveBeenCalled();
  // One lock decision everywhere: I haven't checked in, so Sam's ring and Sam's timeline check-in are both locked.
  expect(home.me.checkIn).toBeNull();
  expect(home.stories.map((r) => r.locked)).toEqual([true]);
  expect(home.timeline.map((i) => ('locked' in i ? i.locked : null))).toEqual([true]);
  expect(home.highlights).not.toBeNull();
});

it('the circle carries when each buddy paired with me, and my own bedtime goal only', async () => {
  const me = await person('Me');
  const sam = await person('Sam');
  await prisma.user.update({ where: { id: me.id }, data: { bedtimeGoal: '22:30' } });
  await prisma.user.update({ where: { id: sam.id }, data: { bedtimeGoal: '21:00' } });
  const pairedAt = new Date('2026-10-05T12:00:00Z');
  await pair(me.id, sam.id, pairedAt);
  const c = await circle.loadCircle(me.id, NOW);
  expect([...c.pairedAt]).toEqual([[sam.id, pairedAt]]);
  expect(c.viewerBedtimeGoal).toBe('22:30');
  expect(JSON.stringify(c.buddies)).not.toContain('21:00'); // a buddy's goal is never kept
});

it('a quiet week is rebuilt for a day after it turns final, then cached empty, so later reads cost one query', async () => {
  // Week 2026-09-28 turns final Mon 2026-10-05 14:00 UTC; the empty build is cached from Tue 2026-10-06 14:00 UTC.
  const early = await person('Early');
  expect(await getWeeklyHighlights(early.id, new Date('2026-10-06T13:59:00Z'))).toBeNull();
  expect(await prisma.weeklyHighlights.count({ where: { viewerId: early.id } })).toBe(0);

  const quiet = await person('Quiet');
  expect(await getWeeklyHighlights(quiet.id, NOW)).toBeNull();
  const cached = await prisma.weeklyHighlights.findMany({ where: { viewerId: quiet.id }, select: { weekStart: true, items: true } });
  expect(cached.map((r) => [r.weekStart.toISOString().slice(0, 10), r.items])).toEqual([[WEEK, []]]);
  mockQueries.count = 0;
  expect(await getWeeklyHighlights(quiet.id, NOW)).toBeNull();
  // loadCircle 4 + the cached row 1: no rebuild.
  expect(mockQueries.count).toBe(5);
});
