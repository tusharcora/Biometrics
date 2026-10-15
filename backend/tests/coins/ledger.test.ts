import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { applyCoinEvents, planCapped, spendInTx, type DayUse } from '../../src/coins/ledger';
import { balance, coinUser, earn, fund, rowsOf } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

const D = '2026-11-02';
/** A full day of P2 sources but one recap: 50 coins. */
const FIFTY = [earn('sleep_goal', `sleep_goal:${D}`, 20, D), earn('steps', `steps:${D}`, 15, D), earn('recap', 'recap:r1', 10, D), earn('checkin', `checkin:${D}`, 5, D)];

describe('planCapped (pure)', () => {
  it('trims capped kinds in (kind, key) order to what is left of the day, never below 0', () => {
    const used: DayUse = new Map([[D, { coins: 50, paidCheers: 0 }]]);
    const out = planCapped([earn('steps', 'steps:x', 15, D), earn('checkin', 'checkin:y', 5, D)], used);
    expect(out.map((e) => [e.kind, e.amount])).toEqual([['checkin', 5], ['steps', 5]]);
    expect(planCapped([earn('recap', 'recap:z', 10, D)], used)[0]!.amount).toBe(0);
  });

  it('leaves uncapped kinds alone and keeps each day apart', () => {
    const used: DayUse = new Map([[D, { coins: 60, paidCheers: 0 }]]);
    const out = planCapped([earn('firstweek', 'firstweek:place', 10), earn('sleep_goal', 'sleep_goal:2026-11-03', 20, '2026-11-03')], used);
    expect(out.map((e) => e.amount)).toEqual([10, 20]);
  });

  it('pays 5 cheers a day, given and received together, and writes the rest as 0 (spec §6.2, ruling 28)', () => {
    const cheers = Array.from({ length: 6 }, (_, k) => earn(k % 2 ? 'cheer_got' : 'cheer_given', `cheer:c${k}:${k % 2 ? 'got' : 'given'}`, 2, D));
    expect(planCapped(cheers, new Map()).map((e) => e.amount).sort()).toEqual([0, 2, 2, 2, 2, 2]);
  });
});

describe('applyCoinEvents (spec §6.3)', () => {
  it('pays each source key once, however many writers race (Review Focus 1)', async () => {
    const { user } = await coinUser();
    const e = earn('sleep_goal', `sleep_goal:${D}`, 20, D);
    const results = await Promise.all(Array.from({ length: 5 }, () => applyCoinEvents(user.id, [e], new Date())));
    expect(results.flat()).toEqual([{ kind: 'sleep_goal', amount: 20 }]);
    expect([(await rowsOf(user.id)).length, await balance(user.id)]).toEqual([1, 20]);
  });

  it('stops at 60 a day: an earn takes what is left, the next writes a 0 row, seen, its key used up (Review Focus 5)', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    const [a] = await applyCoinEvents(user.id, [earn('recap', 'recap:r2', 10, D)], new Date());
    const [b] = await applyCoinEvents(user.id, [earn('steps', 'steps:other', 15, D)], new Date());
    expect([a!.amount, b!.amount, await balance(user.id)]).toEqual([10, 0, 60]);
    const zero = (await rowsOf(user.id)).find((r) => r.sourceKey === 'steps:other')!;
    expect([zero.amount, zero.seenAt instanceof Date]).toEqual([0, true]);
    expect(await applyCoinEvents(user.id, [earn('steps', 'steps:other', 15, D)], new Date())).toEqual([]);
    expect((await applyCoinEvents(user.id, [earn('sleep_goal', 'sleep_goal:2026-11-03', 20, '2026-11-03')], new Date()))[0]!.amount).toBe(20);
  });

  it('trims part of an earn: 55 used leaves 5 of a 20', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, [...FIFTY.slice(0, 3), earn('recap', 'recap:r9', 10, D)], new Date()); // 55
    expect((await applyCoinEvents(user.id, [earn('checkin', 'checkin:late', 20, D)], new Date()))[0]!.amount).toBe(5);
  });

  it('drops replays before trimming: a replayed key never uses up the room a new one needs (spec §6.3)', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    expect(await applyCoinEvents(user.id, [FIFTY[0]!, earn('recap', 'recap:r3', 10, D)], new Date())).toEqual([{ kind: 'recap', amount: 10 }]);
  });

  it('pays uncapped kinds past the cap', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, [...FIFTY, earn('recap', 'recap:r4', 10, D)], new Date());
    await applyCoinEvents(user.id, [earn('firstweek', 'firstweek:streak7', 25)], new Date());
    expect(await balance(user.id)).toBe(85);
  });

  it('writes earns unseen and logs kinds and counts only, never the user or an amount', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    expect((await rowsOf(user.id)).every((r) => r.seenAt === null)).toBe(true);
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('coins.earned'));
    expect(lines.map((l) => JSON.parse(l)).sort((x, y) => (x.kind < y.kind ? -1 : 1))).toEqual([
      { event: 'coins.earned', kind: 'checkin', count: 1 }, { event: 'coins.earned', kind: 'recap', count: 1 },
      { event: 'coins.earned', kind: 'sleep_goal', count: 1 }, { event: 'coins.earned', kind: 'steps', count: 1 },
    ]);
    expect(lines.join('')).not.toContain(user.id);
  });
});

describe('spendInTx and the wallet (spec §6.1, §6.3)', () => {
  it('spends only what is there, writes the spend seen under its request key, and never goes below 0', async () => {
    const { user } = await coinUser();
    await fund(user.id, 100);
    expect(await prisma.$transaction((tx) => spendInTx(tx, user.id, 'buy', 'buy:a', 150, new Date()))).toEqual({ ok: false, needed: 50 });
    expect(await prisma.$transaction((tx) => spendInTx(tx, user.id, 'buy', 'buy:b', 60, new Date()))).toEqual({ ok: true, balance: 40 });
    const row = (await rowsOf(user.id)).find((r) => r.sourceKey === 'buy:b')!;
    expect([row.kind, row.amount, row.capDay, row.seenAt instanceof Date]).toEqual(['buy', -60, null, true]);
    await expect(prisma.coinWallet.update({ where: { userId: user.id }, data: { balance: -1 } })).rejects.toThrow(); // CHECK
  });
});
