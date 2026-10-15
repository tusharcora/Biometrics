import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { localCivilDateOrUtc, utcMidnightToCivilDate } from '../../src/biometrics/civilDate';
import { EMPTY_WORN, PRICES } from '../../src/cosmetics/catalogue';
import { FIRST_WEEK_BONUS, TASK_REWARDS, bonusEarns, checkInRun, ensureStartedOn, firstWeekEarns, readFirstWeek } from '../../src/coins/firstWeek';
import { applyCoinEvents } from '../../src/coins/ledger';
import { EARN_AMOUNTS, coinsConfig, earnCoins } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { shiftDate } from '../../src/scoring/dates';
import { day } from '../cosmetics/helpers';
import { piece, withPieces } from '../room/helpers';
import { balance, coinUser, earn, fund, rowsOf } from './helpers';

const LAUNCH = new Date('2026-10-01T00:00:00.000Z');
const BEFORE = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = LAUNCH;
});
afterAll(async () => {
  coinsConfig.launchedAt = BEFORE;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const list = async (headers: Record<string, string>) => (await (await api()).get('/me/firstweek').set(headers)).body;
const done = (body: { tasks: Array<{ key: string; done: boolean }> }) => body.tasks.filter((t) => t.done).map((t) => t.key).sort();
/** An account made before the coins launch: its day 1 waits for the first look at the list (ruling PF-F3). */
async function olderUser() {
  const u = await coinUser();
  await prisma.user.update({ where: { id: u.user.id }, data: { createdAt: new Date('2026-09-01T00:00:00.000Z') } });
  return u;
}

describe('the bonuses (pure)', () => {
  it('counts the on-time run ending today, or yesterday while today is still due (ruling 22)', () => {
    const days = new Set(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect([checkInRun(days, '2026-11-08'), checkInRun(days, '2026-11-09'), checkInRun(days, '2026-11-10')]).toEqual([4, 4, 0]);
  });

  it('pays the place bonus for a placement up to day 7, a P1 one included; the streak bonus only while open (ruling 23)', () => {
    const base = { startedOn: '2026-11-01', today: '2026-11-04', run: 0 };
    const place = { kind: 'firstweek', sourceKey: 'firstweek:place', amount: 10, capDay: null };
    const streak = { kind: 'firstweek', sourceKey: 'firstweek:streak7', amount: 25, capDay: null };
    expect(bonusEarns({ ...base, firstPlacedOn: '2026-10-16' })).toEqual([place]);
    expect(bonusEarns({ ...base, today: '2026-11-12', firstPlacedOn: '2026-11-07' })).toEqual([place]);
    expect(bonusEarns({ ...base, firstPlacedOn: '2026-11-08' })).toEqual([]);
    expect(bonusEarns({ ...base, firstPlacedOn: null, run: 7 })).toEqual([streak]);
    expect(bonusEarns({ ...base, today: '2026-11-08', firstPlacedOn: null, run: 9 })).toEqual([]);
  });

  it("the rows' rewards are the earn amounts, the two bonuses and the fern's price, so the literals cannot drift", () => {
    expect(TASK_REWARDS).toEqual({
      checkin: EARN_AMOUNTS.checkin, place: FIRST_WEEK_BONUS.place, sleep: EARN_AMOUNTS.sleep_goal, fern: -PRICES['plant.fern']!,
      cheer: EARN_AMOUNTS.cheer, recap: EARN_AMOUNTS.recap, streak7: FIRST_WEEK_BONUS.streak7,
    });
  });
});

describe('day 1 (ruling 21, narrowed by PF-F3)', () => {
  it('is the sign-up date after the launch, the first look for an older account, set once, never before the launch, and never a loadout row', async () => {
    const fresh = await coinUser();
    expect(await ensureStartedOn(fresh.user.id, new Date(), LAUNCH)).toBe(localCivilDateOrUtc(fresh.user.createdAt, 'UTC'));
    const old = await olderUser();
    const now = new Date();
    expect(await ensureStartedOn(old.user.id, now, LAUNCH)).toBe(localCivilDateOrUtc(now, 'UTC'));
    expect(await ensureStartedOn(old.user.id, new Date(now.getTime() + 3 * 86_400_000), LAUNCH)).toBe(localCivilDateOrUtc(now, 'UTC'));
    const early = await coinUser();
    expect(await ensureStartedOn(early.user.id, new Date('2026-09-15T00:00:00.000Z'), LAUNCH)).toBeNull();
    expect(await prisma.roomFirstWeek.findUnique({ where: { userId: early.user.id } })).toBeNull();
    expect(await prisma.cosmeticLoadout.findUnique({ where: { userId: fresh.user.id } })).toBeNull();
  });

  it("a background earn before any look at the list never starts an older account's week, and pays no bonus yet (PF-F3)", async () => {
    const { user, headers } = await olderUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, firstPlacedAt: new Date('2026-09-20T10:00:00.000Z') } });
    await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(habitDayFor(new Date(), 'UTC')), onTime: true } });
    expect(await earnCoins(user.id, new Date())).toBe(1);
    expect((await prisma.roomFirstWeek.findUniqueOrThrow({ where: { userId: user.id } })).startedOn).toBeNull();
    expect((await rowsOf(user.id)).some((r) => r.kind === 'firstweek')).toBe(false);
    // The first look starts day 1 today and pays the P1 placement's +10 in the same answer.
    const body = await list(headers);
    expect([body.day, done(body)]).toEqual([1, ['checkin', 'place']]);
    const row = await prisma.roomFirstWeek.findUniqueOrThrow({ where: { userId: user.id } });
    expect(utcMidnightToCivilDate(row.startedOn!)).toBe(localCivilDateOrUtc(new Date(), 'UTC'));
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'firstweek').map((r) => [r.sourceKey, r.amount])).toEqual([['firstweek:place', 10]]);
  });

  it('a background earn for an account made after the launch pays from its sign-up date without writing day 1', async () => {
    const { user } = await coinUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, firstPlacedAt: new Date() } });
    await earnCoins(user.id, new Date());
    expect((await rowsOf(user.id)).map((r) => r.sourceKey)).toEqual(['firstweek:place']);
    expect((await prisma.roomFirstWeek.findUniqueOrThrow({ where: { userId: user.id } })).startedOn).toBeNull();
  });

  it('a background earn for an account with no first-week row creates none', async () => {
    const { user } = await olderUser();
    await earnCoins(user.id, new Date());
    expect(await prisma.roomFirstWeek.findUnique({ where: { userId: user.id } })).toBeNull();
  });
});

describe('the day 7 boundary is the local midnight, not the UTC one (T8-FIX)', () => {
  // Pacific/Auckland is UTC+13 in November: 2026-11-08 00:00 local is 2026-11-07T11:00Z, still day 7 in UTC.
  const BEFORE_MIDNIGHT = new Date('2026-11-07T10:59:00.000Z');
  const AFTER_MIDNIGHT = new Date('2026-11-07T11:01:00.000Z');
  async function aucklandWeek(firstPlacedAt: Date | null = null) {
    const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
    await prisma.roomFirstWeek.create({ data: { userId: user.id, startedOn: day('2026-11-01'), firstPlacedAt } });
    for (let k = 1; k <= 7; k++) await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(`2026-11-0${k}`), onTime: true } });
    return user.id;
  }
  const keys = (earns: Array<{ sourceKey: string }>) => earns.map((e) => e.sourceKey);

  it('closes the list and stops the streak bonus at the local midnight ending day 7', async () => {
    const userId = await aucklandWeek();
    expect(await readFirstWeek(userId, BEFORE_MIDNIGHT, LAUNCH)).toMatchObject({ open: true, day: 7 });
    expect(keys(await firstWeekEarns(userId, BEFORE_MIDNIGHT, LAUNCH))).toEqual(['firstweek:streak7']);
    expect(await readFirstWeek(userId, AFTER_MIDNIGHT, LAUNCH)).toEqual({ open: false });
    expect(await firstWeekEarns(userId, AFTER_MIDNIGHT, LAUNCH)).toEqual([]);
  });

  it('a placement just after that midnight is day 8 and pays nothing, though its UTC date is day 7', async () => {
    const userId = await aucklandWeek(new Date('2026-11-07T11:30:00.000Z'));
    expect(keys(await firstWeekEarns(userId, new Date('2026-11-07T12:00:00.000Z'), LAUNCH))).toEqual([]);
  });

  it('a placement late on local day 7 pays +10 though its UTC date is day 8 (a zone behind UTC)', async () => {
    // Auckland is ahead of UTC, so its local day 7 is never UTC day 8; Honolulu (UTC-10) shows that side.
    const { user } = await coinUser({ timezone: 'Pacific/Honolulu' });
    await prisma.roomFirstWeek.create({ data: { userId: user.id, startedOn: day('2026-11-01'), firstPlacedAt: new Date('2026-11-08T06:00:00.000Z') } });
    expect(keys(await firstWeekEarns(user.id, new Date('2026-11-08T06:30:00.000Z'), LAUNCH))).toEqual(['firstweek:place']);
    expect(keys(await firstWeekEarns(user.id, new Date('2026-11-10T06:30:00.000Z'), LAUNCH))).toEqual(['firstweek:place']);
  });
});

describe('GET /me/firstweek (spec §11.2, §12)', () => {
  it('a 0-coin row written at the full cap still ticks its task', async () => {
    const { user, headers } = await coinUser();
    const today = localCivilDateOrUtc(new Date(), 'UTC');
    await applyCoinEvents(user.id, [
      earn('sleep_goal', 'sleep_goal:a', 20, today), earn('sleep_goal', 'sleep_goal:b', 20, today),
      earn('steps', `steps:${today}`, 15, today), earn('checkin', `checkin:${today}`, 5, today),
    ], new Date());
    await applyCoinEvents(user.id, [earn('recap', 'recap:capped', 10, today)], new Date());
    expect((await rowsOf(user.id)).find((r) => r.sourceKey === 'recap:capped')?.amount).toBe(0);
    expect(done(await list(headers))).toEqual(['checkin', 'recap', 'sleep']);
  });

  it('day 1: seven rows, nothing done, the next size teased, private no-store', async () => {
    const { headers } = await coinUser();
    const res = await (await api()).get('/me/firstweek').set(headers);
    expect([res.status, res.headers['cache-control'], res.body]).toEqual([200, 'private, no-store', {
      open: true, day: 1, done: 0,
      tasks: [
        { key: 'checkin', done: false, reward: 5 }, { key: 'place', done: false, reward: 10 }, { key: 'sleep', done: false, reward: 20 },
        { key: 'fern', done: false, reward: -40 }, { key: 'cheer', done: false, reward: 2 }, { key: 'recap', done: false, reward: 10 },
        { key: 'streak7', done: false, reward: 25 },
      ],
      next: { tier: 2, coins: 600, streak: 14 },
    }]);
  });

  it('a first placement made in P1, before coins, pays its +10 once when P2 arrives, outside a full cap (§0 ruling)', async () => {
    const { user, headers } = await coinUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, firstPlacedAt: new Date('2026-09-20T10:00:00.000Z') } });
    const today = localCivilDateOrUtc(new Date(), 'UTC');
    await applyCoinEvents(user.id, [
      earn('sleep_goal', `sleep_goal:${today}`, 20, today), earn('steps', `steps:${today}`, 15, today),
      earn('recap', 'recap:x', 10, today), earn('recap', 'recap:y', 10, today), earn('checkin', `checkin:${today}`, 5, today),
    ], new Date());
    expect(done(await list(headers))).toEqual(['checkin', 'place', 'recap', 'sleep']);
    expect(await balance(user.id)).toBe(70);
    await list(headers);
    expect((await rowsOf(user.id)).filter((r) => r.sourceKey === 'firstweek:place')).toHaveLength(1);
  });

  it('the first save that places a piece pays its +10 at once', async () => {
    const { user, headers } = await coinUser();
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
    expect((await rowsOf(user.id)).map((r) => [r.sourceKey, r.amount])).toEqual([['firstweek:place', 10]]);
  });

  it('7 on-time check-ins in a row pay +25 once; the fern row ticks on a bought fern (rulings 22, 24)', async () => {
    const { user, headers } = await coinUser();
    const today = habitDayFor(new Date(), 'UTC');
    for (let k = 0; k < 7; k++) await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(shiftDate(today, -k)), onTime: true } });
    await fund(user.id, 40);
    expect((await (await api()).post('/me/shop/purchases').set(headers).send({ requestId: randomUUID(), itemId: 'plant.fern' })).status).toBe(200);
    expect(done(await list(headers))).toEqual(['checkin', 'fern', 'streak7']);
    await list(headers);
    expect((await rowsOf(user.id)).filter((r) => r.sourceKey === 'firstweek:streak7').map((r) => r.amount)).toEqual([25]);
  });

  it('after day 7 the list is gone, and a bonus not reached by then lapses quietly', async () => {
    const { user, headers } = await coinUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, startedOn: day(shiftDate(localCivilDateOrUtc(new Date(), 'UTC'), -8)) } });
    expect(await list(headers)).toEqual({ open: false });
    await prisma.roomFirstWeek.update({ where: { userId: user.id }, data: { firstPlacedAt: new Date() } });
    await list(headers);
    expect((await rowsOf(user.id)).some((r) => r.kind === 'firstweek')).toBe(false);
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/firstweek')).status).toBe(401);
  });
});
