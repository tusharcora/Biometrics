// Two-person cheers (spec 2026-10-15 §6.3): both users' locks in sorted id order in one transaction.
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { COIN_TX_OPTIONS, cheerEarns, lockUsers, logEarned, writeEarnsTx } from '../../src/coins/ledger';
import { lockRoom } from '../../src/room/lock';
import { balance, coinUser, earn, rowsOf } from './helpers';

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

it('lockUsers is re-entrant with a room lock the transaction already holds', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  const hi = a.id > b.id ? a.id : b.id;
  await prisma.$transaction(async (tx) => {
    await lockRoom(tx, hi);
    await lockUsers(tx, [a.id, b.id]);
    await writeEarnsTx(tx, hi, [cheerEarns('cheer:re', DAY, 'got')], new Date());
  }, COIN_TX_OPTIONS);
  expect(await balance(hi)).toBe(2);
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
