import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { coinsConfig, coinsHooks, earnCoins, earnCoinsSafely, loadEarnInputs, planEarns } from '../../src/coins/sources';
import { day, weekRecaps } from '../cosmetics/helpers';
import { balance, coinUser, rowsOf } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const LAUNCH = new Date('2026-10-01T00:00:00.000Z');
// 2026-11-11 09:30 in Auckland (NZDT, +13): today and the habit day are 2026-11-11; the 8 days run from 2026-11-04.
const NOW = new Date('2026-11-10T20:30:00.000Z');

/** An Auckland user's week: three nights in the window, one outside; a goal eased to 7 h on 2026-11-08. */
async function seededWeek() {
  const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
  const sleep = (d: string, minutes: number) => prisma.biometricRecord.create({ data: { userId: user.id, metricType: 'SLEEP', value: minutes, recordedAt: day(d) } });
  await sleep('2026-11-11', 480);
  await sleep('2026-11-10', 400); // below the 420 in effect
  await sleep('2026-11-09', 430); // at or above 420, below the stored 480: the goal in effect counts (ruling 27)
  await sleep('2026-11-03', 600); // before the 8 days
  await prisma.goalChange.create({ data: { userId: user.id, kind: 'SLEEP_MINUTES', sleepMinutes: 420, effectiveOn: day('2026-11-08'), resetsStreak: true } });
  await prisma.stepGoalEvent.create({ data: { authorId: user.id, localDate: day('2026-11-09') } });
  await prisma.stepGoalEvent.create({ data: { authorId: user.id, localDate: day('2026-11-02') } });
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day('2026-11-10'), onTime: true } });
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day('2026-11-09'), onTime: false } }); // late: never pays
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 60 * 60 * 1000)); // opened 08:30 local, 2026-11-11
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 60 * 60 * 1000), 'MONTH', 5); // a month: never pays
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 10 * 86_400_000), 'WEEK', 9); // opened 10 days ago
  return user;
}

it('plans each source with its key and its own civil date as the cap day, and nothing before the launch day (spec §6.2)', () => {
  const earns = planEarns({
    launchDay: '2026-11-10',
    sleepGoalNights: ['2026-11-09', '2026-11-11'], stepGoalDays: ['2026-11-10'], onTimeCheckIns: ['2026-11-10'],
    weekRecapOpens: [{ id: 'r1', day: '2026-11-11' }],
  });
  expect(earns).toEqual([
    { kind: 'sleep_goal', sourceKey: 'sleep_goal:2026-11-11', amount: 20, capDay: '2026-11-11' },
    { kind: 'steps', sourceKey: 'steps:2026-11-10', amount: 15, capDay: '2026-11-10' },
    { kind: 'checkin', sourceKey: 'checkin:2026-11-10', amount: 5, capDay: '2026-11-10' },
    { kind: 'recap', sourceKey: 'recap:r1', amount: 10, capDay: '2026-11-11' },
  ]);
});

it('reads the last 8 local days in the user\'s zone: goal nights by the goal in effect, step days, on-time check-ins, week recaps opened (Review Focus 2)', async () => {
  const user = await seededWeek();
  const recap = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'WEEK', openedAt: { gte: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) } } });
  expect(await loadEarnInputs(user.id, NOW, LAUNCH)).toEqual({
    launchDay: '2026-10-01',
    sleepGoalNights: ['2026-11-09', '2026-11-11'],
    stepGoalDays: ['2026-11-09'],
    onTimeCheckIns: ['2026-11-10'],
    weekRecapOpens: [{ id: recap.id, day: '2026-11-11' }],
  });
});

it('reads week recaps opened from the local midnight that starts the 8 days, the window every source shares', async () => {
  const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
  // The 8 days start 2026-11-04, whose Auckland midnight is 2026-11-03 11:00 UTC (8 x 24 h back would be 11-02 20:30).
  await weekRecaps(user.id, 1, new Date('2026-11-03T10:59:00.000Z')); // 23:59 on 2026-11-03: outside
  await weekRecaps(user.id, 1, new Date('2026-11-03T11:00:00.000Z'), 'WEEK', 1); // 00:00 on 2026-11-04: inside
  const inside = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, openedAt: new Date('2026-11-03T11:00:00.000Z') } });
  expect((await loadEarnInputs(user.id, NOW, LAUNCH))?.weekRecapOpens).toEqual([{ id: inside.id, day: '2026-11-04' }]);
});

it('pays every source once, keeps a revised night\'s coins, and stores no health value (spec §6.1, §6.2)', async () => {
  const user = await seededWeek();
  expect(await earnCoins(user.id, NOW, { launchedAt: LAUNCH })).toBe(5);
  expect(await balance(user.id)).toBe(70); // 20 + 20 + 15 + 5 + 10
  expect(await earnCoins(user.id, NOW, { launchedAt: LAUNCH })).toBe(0);
  await prisma.biometricRecord.updateMany({ where: { userId: user.id, metricType: 'SLEEP', recordedAt: day('2026-11-11') }, data: { value: 300 } });
  expect([await earnCoins(user.id, NOW, { launchedAt: LAUNCH }), await balance(user.id)]).toEqual([0, 70]);
  const recap = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'WEEK', openedAt: { gte: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) } } });
  const rows = await rowsOf(user.id);
  // A row is a kind, a key and an amount (plus ids and instants): the keys carry a civil date or a recap id only.
  expect(rows.map((r) => [r.kind, r.sourceKey, r.amount]).sort()).toEqual([
    ['checkin', 'checkin:2026-11-10', 5],
    ['recap', `recap:${recap.id}`, 10],
    ['sleep_goal', 'sleep_goal:2026-11-09', 20],
    ['sleep_goal', 'sleep_goal:2026-11-11', 20],
    ['steps', 'steps:2026-11-09', 15],
  ]);
  for (const r of rows) expect(r.sourceKey).toMatch(/^(sleep_goal|steps|checkin):\d{4}-\d{2}-\d{2}$|^recap:[0-9a-f-]{36}$/);
});

it('pays nothing dated before the user\'s local launch day, not even a 0 row (spec §6.2 no backpay)', async () => {
  const user = await seededWeek();
  // 2026-11-09 12:00 UTC is 01:00 on 2026-11-10 in Auckland: the launch day is 2026-11-10 there, 2026-11-09 in UTC,
  // so only the zoned launch day keeps the 11-09 night and step day out.
  await earnCoins(user.id, NOW, { launchedAt: new Date('2026-11-09T12:00:00.000Z') });
  const keys = (await rowsOf(user.id)).map((r) => r.sourceKey);
  expect(keys.some((k) => k.endsWith('2026-11-09'))).toBe(false);
  expect(await balance(user.id)).toBe(35); // the 11-11 night, the 11-10 check-in, the 11-11 recap
});

it('parks the coins launch in 2100 under Jest, so suites that never name it write no coin rows (ruling PF-F7)', async () => {
  expect(coinsConfig.launchedAt.toISOString()).toBe('2100-01-01T00:00:00.000Z');
  const user = await seededWeek();
  expect(await earnCoins(user.id, NOW)).toBe(0);
  expect(await rowsOf(user.id)).toEqual([]);
});

it('uses coinsConfig.launchedAt by default, and a failed earn is logged without values and never throws', async () => {
  const user = await seededWeek();
  const before = coinsConfig.launchedAt;
  coinsConfig.launchedAt = LAUNCH;
  try {
    expect(await earnCoins(user.id, NOW)).toBe(5);
  } finally {
    coinsConfig.launchedAt = before;
  }
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const spy = jest.spyOn(coinsHooks, 'earn').mockRejectedValue(new TypeError('boom'));
  await expect(earnCoinsSafely(user.id, NOW)).resolves.toBeUndefined();
  expect(warn.mock.calls.map((c) => JSON.parse(String(c[0])))).toEqual([{ event: 'coins.earn_failed', error: 'TypeError' }]);
  spy.mockRestore();
  warn.mockRestore();
});
