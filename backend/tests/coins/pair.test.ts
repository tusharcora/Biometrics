// Two-person cheers (spec 2026-10-15 §6.3): both users' locks in lock-key order (hashtext of the id) in one
// transaction.
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { COIN_TX_OPTIONS, cheerEarns, lockUsers, logEarned, writeEarnsTx } from '../../src/coins/ledger';
import { lockRoom } from '../../src/room/lock';
import { balance, coinUser, earn, rowsOf } from './helpers';

// lockRoom still takes the real lock; the spy records the order lockUsers takes them in.
jest.mock('../../src/room/lock', () => {
  const actual = jest.requireActual('../../src/room/lock');
  return { ...actual, lockRoom: jest.fn(actual.lockRoom) };
});
const lockSpy = lockRoom as jest.MockedFunction<typeof lockRoom>;

/** The room lock key of each id (lockRoom's hashtext). */
async function keysOf(...ids: string[]): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; key: number }>>`SELECT id, hashtext(id) AS key FROM unnest(${ids}::text[]) AS id`;
  return new Map(rows.map((r) => [r.id, r.key]));
}
/** Two users' ids as [lower lock key, higher lock key]. */
async function byKey(a: string, b: string): Promise<[string, string]> {
  const keys = await keysOf(a, b);
  return keys.get(a)! < keys.get(b)! ? [a, b] : [b, a];
}
/** The ids lockRoom was called with during `run`. */
async function lockedDuring(run: () => Promise<unknown>): Promise<string[]> {
  lockSpy.mockClear();
  await run();
  return lockSpy.mock.calls.map((c) => c[1]);
}

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const DAY = '2026-10-26';
const pay = (giver: string, owner: string, key: string) =>
  prisma.$transaction(async (tx) => {
    await lockUsers(tx, [giver, owner]);
    await writeEarnsTx(tx, giver, [cheerEarns(key, DAY, 'given')], new Date());
    await writeEarnsTx(tx, owner, [cheerEarns(key, DAY, 'got')], new Date());
  }, COIN_TX_OPTIONS);

it('a cheer pays both sides 2 coins under the given and got kinds', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  await pay(a.id, b.id, 'cheer:x1');
  expect((await rowsOf(a.id)).map((r) => [r.kind, r.sourceKey, r.amount])).toEqual([['cheer_given', 'cheer:x1:given', 2]]);
  expect((await rowsOf(b.id)).map((r) => [r.kind, r.sourceKey, r.amount])).toEqual([['cheer_got', 'cheer:x1:got', 2]]);
});

it('two people cheering each other at once never deadlock (Review Focus 1)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  await Promise.all([pay(a.id, b.id, 'cheer:ab'), pay(b.id, a.id, 'cheer:ba')]);
  expect([await balance(a.id), await balance(b.id)]).toEqual([4, 4]);
});

it('many crossed cheers at once all land, each key once (sorted locks, idempotent keys)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  await Promise.all([pay(a.id, b.id, 'cheer:m1'), pay(b.id, a.id, 'cheer:m2'), pay(a.id, b.id, 'cheer:m1'), pay(b.id, a.id, 'cheer:m2')]);
  expect([await balance(a.id), await balance(b.id), (await rowsOf(a.id)).length, (await rowsOf(b.id)).length]).toEqual([4, 4, 2, 2]);
});

it('the sixth paid cheer of a day, given and received together, writes 0 (spec §6.2)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  for (let k = 0; k < 6; k++) await pay(a.id, b.id, `cheer:n${k}`);
  expect((await rowsOf(a.id)).map((r) => r.amount)).toEqual([2, 2, 2, 2, 2, 0]);
});

it('lockUsers takes each distinct id once (a self-pair never waits on itself)', async () => {
  const { user } = await coinUser();
  await prisma.$transaction(async (tx) => { await lockUsers(tx, [user.id, user.id]); });
});

it('lockUsers is re-entrant with the lowest-key room lock the transaction already holds', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  const [lo] = await byKey(a.id, b.id);
  await prisma.$transaction(async (tx) => {
    await lockRoom(tx, lo);
    await lockUsers(tx, [a.id, b.id]);
    await writeEarnsTx(tx, lo, [cheerEarns('cheer:re', DAY, 'got')], new Date());
  }, COIN_TX_OPTIONS);
  expect(await balance(lo)).toBe(2);
});

it('lockUsers takes each distinct key once, lowest key first (T3-FIX M2)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  const [lo, hi] = await byKey(a.id, b.id);
  expect(await lockedDuring(() => prisma.$transaction((tx) => lockUsers(tx, [hi, lo, hi])))).toEqual([lo, hi]);
  expect(await lockedDuring(() => prisma.$transaction((tx) => lockUsers(tx, [lo, hi])))).toEqual([lo, hi]);
});

it('orders by the lock key, not the id: ids whose keys collide never lock in opposite orders (T3-FIX M1)', async () => {
  // Two different strings with one hashtext (about ten collide among 300k), and a third id between them by text.
  const [pair] = await prisma.$queryRaw<Array<{ ids: string[] }>>`
    SELECT array_agg(s ORDER BY s) AS ids FROM (SELECT 'k' || g AS s FROM generate_series(1, 300000) g) t
    GROUP BY hashtext(s) HAVING count(*) > 1 LIMIT 1`;
  const [x, z] = pair!.ids as [string, string];
  const mids = [`${x}0`, `${x}1`, `${x}2`];
  const keys = await keysOf(x, z, ...mids);
  const y = mids.find((m) => m > x && m < z && keys.get(m) !== keys.get(x))!;
  expect([x < y, y < z, keys.get(x) === keys.get(z)]).toEqual([true, true, true]);
  const [first, second] = keys.get(x)! < keys.get(y)! ? [x, y] : [y, x];
  // By id, [x, y] would lock x's key then y's and [y, z] y's key then z's (= x's): opposite orders, a deadlock.
  expect(await lockedDuring(() => prisma.$transaction((tx) => lockUsers(tx, [x, y])))).toEqual([first, second]);
  const second2 = await lockedDuring(() => prisma.$transaction((tx) => lockUsers(tx, [y, z])));
  expect(second2.map((id) => keys.get(id))).toEqual([keys.get(first), keys.get(second)]);
  // Colliding ids are one key: taken once.
  expect(await lockedDuring(() => prisma.$transaction((tx) => lockUsers(tx, [z, x])))).toHaveLength(1);
});

it('writeEarnsTx checks its own earns: a capped earn without its day throws and writes nothing', async () => {
  const { user } = await coinUser();
  await expect(prisma.$transaction(async (tx) => {
    await lockUsers(tx, [user.id]);
    await writeEarnsTx(tx, user.id, [earn('cheer_given', 'cheer:bad:given', 2)], new Date());
  })).rejects.toThrow('capped earn needs its civil day');
  expect(await rowsOf(user.id)).toEqual([]);
});

it('cheerEarns is one side of a cheer: 2 coins on the given day, keyed by side', () => {
  expect(cheerEarns('cheer:k', DAY, 'given')).toEqual({ kind: 'cheer_given', sourceKey: 'cheer:k:given', amount: 2, capDay: DAY });
  expect(cheerEarns('cheer:k', DAY, 'got')).toEqual({ kind: 'cheer_got', sourceKey: 'cheer:k:got', amount: 2, capDay: DAY });
});

it('logEarned logs kinds and counts only, never a user id, a key or an amount', () => {
  logEarned([{ kind: 'cheer_given', amount: 2 }, { kind: 'cheer_given', amount: 0 }, { kind: 'cheer_got', amount: 2 }]);
  expect(quiet.mock.calls.map((c) => JSON.parse(String(c[0])))).toEqual([
    { event: 'coins.earned', kind: 'cheer_given', count: 2 }, { event: 'coins.earned', kind: 'cheer_got', count: 1 },
  ]);
  logEarned([]);
  expect(quiet).toHaveBeenCalledTimes(2);
});
