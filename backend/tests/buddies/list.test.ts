import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { BUDDY_SHARING_CONSENT_VERSION } from '../../src/buddies/sharing';
import { listBuddies } from '../../src/buddies/list';
import { encodeCursor, parseCursor } from '../../src/buddies/cursor';
import { seedNight } from '../recap/helpers';
import { api, buddyUser, pairUp } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-10T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

it('round-trips a cursor and refuses a malformed one', () => {
  const c = { at: NOW, id: '0b5e3f9e-1b2c-4d5e-8f90-123456789abc' };
  expect(parseCursor(encodeCursor(c))).toEqual(c);
  expect(parseCursor(undefined)).toBeNull();
  for (const bad of ['nope', Buffer.from('["x","y"]').toString('base64url'), 42]) expect(() => parseCursor(bad)).toThrow('invalid_cursor');
});

it('pages by (lastActivityAt, id) newest first, with ties broken by id', async () => {
  const me = await buddyUser();
  const buddies = await Promise.all(Array.from({ length: 5 }, () => buddyUser()));
  const minutes = [50, 40, 30, 30, 10];
  const pairs = [];
  for (const [i, b] of buddies.entries()) pairs.push(await pairUp(me.id, b.id, at(minutes[i]!)));
  const tie = [pairs[2]!, pairs[3]!].sort((x, y) => (x.id < y.id ? 1 : -1));
  const expected = [buddies[4]!.id, ...tie.map((p) => (p.userAId === me.id ? p.userBId : p.userAId)), buddies[1]!.id, buddies[0]!.id];

  const seen: string[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await listBuddies(me.id, cursor ?? undefined, NOW, 2);
    seen.push(...page.buddies.map((b) => b.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(seen).toEqual(expected);
});

it("fills each row's mood from batched reads in each buddy's zone, with no number and no streak", async () => {
  const me = await buddyUser();
  const steady = await buddyUser({ displayName: 'Ana', timezone: 'Pacific/Auckland' });
  const mover = await buddyUser({ displayName: 'Ben' });
  await pairUp(me.id, steady.id, at(5));
  await pairUp(me.id, mover.id, at(1));
  await seedNight(steady.id, '2026-10-11', { minutes: 400, recovery: 20 });
  await seedNight(mover.id, '2026-10-09', { minutes: 400, recovery: 90, steps: 15000 });
  await prisma.user.update({ where: { id: mover.id }, data: { shareSteps: true, shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION } });
  await prisma.sticker.create({ data: { fromUserId: steady.id, toUserId: me.id, kind: 'HEART' } });
  const scoreReads = jest.spyOn(prisma.dailyScore, 'findMany');

  const page = await listBuddies(me.id, undefined, NOW);
  expect(page.buddies.map((b) => [b.displayName, b.mood, b.moodLine, b.unseenSticker])).toEqual([
    ['Ben', 'good', 'Well rested · moved a lot yesterday', false],
    ['Ana', 'low', 'Running low today', true],
  ]);
  expect(scoreReads).toHaveBeenCalledTimes(1);
  scoreReads.mockRestore();
  // Without ids and (hex) handles nothing numeric is left: no score, no steps, no streak.
  const json = JSON.stringify(page.buddies)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'ID')
    .replace(/"handle":"[^"]*"/g, '"handle":"H"');
  expect(json).not.toMatch(/\d/);
  expect(json).not.toContain('streak');
});

it('GET /me/buddies answers the first page with request counts; a bad cursor is 400', async () => {
  const me = await buddyUser();
  const other = await buddyUser();
  await prisma.buddyRequest.create({ data: { fromUserId: other.id, toUserId: me.id } });
  const res = await (await api()).get('/me/buddies').set(await authHeaderFor(me.id));
  expect([res.status, res.body]).toEqual([200, { buddies: [], nextCursor: null, incomingRequests: 1, outgoingRequests: 0 }]);
  expect(res.headers['cache-control']).toBe('private, no-store');
  const bad = await (await api()).get('/me/buddies').query({ cursor: 'zzz' }).set(await authHeaderFor(me.id));
  expect([bad.status, bad.body]).toEqual([400, { error: 'invalid_cursor' }]);
  const twice = await (await api()).get('/me/buddies?cursor=a&cursor=b').set(await authHeaderFor(me.id));
  expect([twice.status, twice.body]).toEqual([400, { error: 'invalid_cursor' }]);
});
