// Results in your own circle (spec 2026-10-15 §10.4; P4 rulings 6, 28; PF4-F18, T7-FIX).
import { prisma } from '../../src/db/client';
import { deleteUserAccount } from '../../src/users/deletion';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { judgeCircle, readResults, settleChallenges } from '../../src/challenges/judge';
import { challengeClock } from '../../src/challenges/week';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';

const CLOCK = challengeClock.now;
const noop = { deleteSubscription: async () => {}, revokeToken: async () => {}, log: () => {} };
beforeAll(() => migrateTestDb());
afterAll(async () => {
  challengeClock.now = CLOCK;
  await prisma.$disconnect();
  await connection.quit();
});

const W = '2026-W44';
const BEFORE = new Date('2026-11-02T07:59:00.000Z');
const AFTER = new Date('2026-11-02T08:00:00.000Z');

async function circleOf(n: number, names: string[] = []) {
  const users = await Promise.all(Array.from({ length: n }, (_, i) => buddyUser(names[i] ? { displayName: names[i] } : {})));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) await pairUp(users[i]!.id, users[j]!.id);
  for (const u of users) {
    await prisma.challengeEntry.create({ data: { userId: u.id, weekId: W, snapshot: {}, circle: users.filter((o) => o.id !== u.id).map((o) => o.id) } });
  }
  return users;
}
const cheers = (weekId: string, to: string, from: string[]) =>
  prisma.challengeCheer.createMany({ data: from.map((f) => ({ weekId, fromId: f, toId: to })) });

it('the most cheers win, ties all win, no ranking under 3 entries', () => {
  expect(judgeCircle(new Map([['a', 2], ['b', 2], ['c', 1]]))).toEqual({ ranked: true, winners: ['a', 'b'] });
  expect(judgeCircle(new Map([['a', 3], ['b', 0]]))).toEqual({ ranked: false, winners: [] });
  expect(judgeCircle(new Map([['a', 0], ['b', 0], ['c', 0]]))).toEqual({ ranked: true, winners: ['a', 'b', 'c'] });
});

it('grants the trophy once, only from Monday 08:00 UTC, to every tied winner', async () => {
  const [a, b, c] = await circleOf(3);
  await cheers(W, a!.id, [b!.id, c!.id]);
  await cheers(W, b!.id, [a!.id, c!.id]);
  await cheers(W, c!.id, [a!.id]);
  expect(await settleChallenges(a!.id, BEFORE)).toBe(0);
  expect(await readResults(a!.id, BEFORE)).toBeNull();
  for (const u of [a!, b!, c!]) await settleChallenges(u.id, AFTER);
  expect(await settleChallenges(a!.id, AFTER)).toBe(0); // judged once (judgedAt)
  const prizes = await prisma.itemGrant.findMany({ where: { sourceKey: `prize:${W}`, userId: { in: [a!.id, b!.id, c!.id] } }, select: { userId: true, itemId: true } });
  expect(prizes.map((p) => [p.userId, p.itemId]).sort()).toEqual([[a!.id, 'corner.acorn'], [b!.id, 'corner.acorn']].sort());
  const res = await readResults(a!.id, AFTER);
  expect(res).toMatchObject({ week: W, themeId: 'cosyAutumn', ranked: true, you: { entered: true, won: true } });
  expect(res!.entries.map((e) => e.cheers).sort()).toEqual([1, 2, 2]);
  expect(res!.winners).toHaveLength(2);
});

it('under 3 entries nobody is ranked and nobody gets the trophy (C3\'s risk)', async () => {
  const [a, b] = await circleOf(2);
  await cheers(W, a!.id, [b!.id]);
  await settleChallenges(a!.id, AFTER);
  expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(0);
  expect(await readResults(a!.id, AFTER)).toMatchObject({ ranked: false, winners: [], you: { entered: true, won: false } });
});

it('the circle is the one frozen on the entry: a buddy paired after the close is not in it', async () => {
  const [a, b, c] = await circleOf(3);
  const late = await buddyUser();
  await pairUp(a!.id, late.id);
  await prisma.challengeEntry.create({ data: { userId: late.id, weekId: W, snapshot: {}, circle: [a!.id] } });
  await cheers(W, late.id, [a!.id, b!.id, c!.id]);
  await settleChallenges(a!.id, AFTER);
  expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(1);
});

it('results carry names and counts only, never an id (ruling 28)', async () => {
  const [a] = await circleOf(3, ['Ana', 'Ben', 'Cy']);
  const res = await readResults(a!.id, AFTER);
  expect(res!.entries.map((e) => e.name).sort()).toEqual(['Ana', 'Ben', 'Cy']);
  expect(res!.entries.map((e) => Object.keys(e).sort())).toEqual(Array(3).fill(['cheers', 'mine', 'name']));
  expect(res!.winners.sort()).toEqual(['Ana', 'Ben', 'Cy']);
  const users = await prisma.challengeEntry.findMany({ where: { userId: a!.id } });
  expect(JSON.stringify(res)).not.toContain(users[0]!.userId);
});

it('results leave out anyone the viewer blocked or who blocked the viewer (PF4-F18)', async () => {
  const [a, b, c, d] = await circleOf(4, ['Ana', 'Ben', 'Cy', 'Dee']);
  await cheers(W, c!.id, [a!.id, b!.id, d!.id]);
  await prisma.buddyBlock.create({ data: { blockerId: a!.id, blockedId: c!.id } });
  await prisma.buddyBlock.create({ data: { blockerId: d!.id, blockedId: a!.id } });
  const res = await readResults(a!.id, AFTER);
  expect(res!.entries.map((e) => e.name).sort()).toEqual(['Ana', 'Ben']);
  // Cy won the circle; the name is left out, and so is the win line's name.
  expect(res).toMatchObject({ ranked: true, winners: [], you: { entered: true, won: false } });
});

it('without an entry, results show your current buddies\' entries', async () => {
  const [a, b, c] = await circleOf(3, ['Ana', 'Ben', 'Cy']);
  const watcher = await buddyUser();
  for (const u of [a!, b!, c!]) await pairUp(watcher.id, u.id);
  expect(await readResults(watcher.id, AFTER)).toMatchObject({ ranked: true, you: { entered: false, won: false } });
  expect((await readResults(watcher.id, AFTER))!.entries).toHaveLength(3);
});

it('GET /me/cosmetics judges a closed entry: the trophy lands with the room read (ruling 6)', async () => {
  const [a] = await circleOf(3);
  challengeClock.now = () => AFTER;
  try {
    const res = await (await api()).get('/me/cosmetics').set(await authHeaderFor(a!.id));
    expect(res.status).toBe(200);
  } finally {
    challengeClock.now = CLOCK;
  }
  expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}`, itemId: 'corner.acorn' } })).toBe(1);
  expect((await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: a!.id, weekId: W } } })).judgedAt).not.toBeNull();
});

it('GET /me/challenge answers last week\'s results in the body', async () => {
  const [a] = await circleOf(3, ['Ana', 'Ben', 'Cy']);
  challengeClock.now = () => new Date('2026-11-04T12:00:00.000Z');
  try {
    const res = await (await api()).get('/me/challenge').set(await authHeaderFor(a!.id));
    expect(res.body.results).toMatchObject({ week: W, ranked: true, you: { entered: true, won: true } });
  } finally {
    challengeClock.now = CLOCK;
  }
});

describe('ruling T7-FIX', () => {
  it('two judging reads at once grant the trophy once (M6)', async () => {
    const [a] = await circleOf(3);
    const judged = await Promise.all([settleChallenges(a!.id, AFTER), settleChallenges(a!.id, AFTER)]);
    expect(judged.sort()).toEqual([0, 1]);
    expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(1);
  });

  it('the judged outcome is stored: a circle member deleted later changes neither your rank nor your win (M2)', async () => {
    const [a, b, c] = await circleOf(3, ['Ana', 'Ben', 'Cy']);
    await cheers(W, b!.id, [a!.id, c!.id]);
    await cheers(W, a!.id, [c!.id]);
    expect(await settleChallenges(a!.id, AFTER)).toBe(1);
    expect(await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: a!.id, weekId: W } } })).toMatchObject({ ranked: true, won: false });
    // Ben, the winner, leaves: two entries are left, and live Ana would now top an unranked circle.
    await deleteUserAccount(b!.id, noop);
    const res = await readResults(a!.id, AFTER);
    expect(res).toMatchObject({ ranked: true, winners: [], you: { entered: true, won: false } });
    expect(res!.entries.map((e) => e.name).sort()).toEqual(['Ana', 'Cy']);
    expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(0);
  });

  it('a stored win stays a win after the circle shrinks below three (M2)', async () => {
    const [a, b] = await circleOf(3, ['Ana', 'Ben', 'Cy']);
    await cheers(W, a!.id, [b!.id]);
    await settleChallenges(a!.id, AFTER);
    await deleteUserAccount(b!.id, noop);
    expect(await readResults(a!.id, AFTER)).toMatchObject({ ranked: true, winners: ['Ana'], you: { entered: true, won: true } });
    expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(1);
  });
});
