import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { buddyUser } from '../buddies/helpers';
import { CHEER_SCAN_ROWS, MAX_CHEERS_COUNTED, cheerTimes, countersOf, loadUnlockFacts } from '../../src/cosmetics/facts';
import { STICKERS_PER_BUDDY_PER_DAY } from '../../src/buddies/stickers';
import { cosmeticsHooks, grantCosmetics, grantCosmeticsSafely } from '../../src/cosmetics/unlock';
import { level, sticker, unlocked, weekRecaps } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const NOW = new Date('2026-10-20T12:00:00Z');
const AFTER = new Date('2026-10-18T12:00:00Z');
const LAUNCH = { launchedAt: { 1: new Date('2026-10-15T00:00:00Z') } };

it('counts only opened WEEK recaps', async () => {
  const u = await buddyUser();
  await weekRecaps(u.id, 2, AFTER);
  await weekRecaps(u.id, 1, null, 'WEEK', 2);
  await weekRecaps(u.id, 1, AFTER, 'MONTH', 3);
  expect(countersOf(await loadUnlockFacts(u.id)).recapsRead).toBe(2);
});

it('counts at most one cheer per buddy per local day in the sender\'s zone, and stops at 15', async () => {
  const me = await buddyUser({ timezone: 'America/Los_Angeles' });
  const a = await buddyUser();
  const b = await buddyUser();
  await sticker(me.id, a.id, new Date('2026-10-19T16:00:00Z')); // Oct 19, 09:00 LA
  await sticker(me.id, a.id, new Date('2026-10-19T20:00:00Z')); // Oct 19, 13:00 LA: the same cheer
  await sticker(me.id, a.id, new Date('2026-10-20T06:30:00Z')); // Oct 19, 23:30 LA: still Oct 19
  await sticker(me.id, a.id, new Date('2026-10-20T08:00:00Z')); // Oct 20, 01:00 LA: a new day
  await sticker(me.id, b.id, new Date('2026-10-19T16:05:00Z')); // another buddy, same day
  expect(countersOf(await loadUnlockFacts(me.id)).buddyCheers).toBe(3);
});

it('cheerTimes stops at 15, and the scan bound holds 15 buddy-days at the per-day limit', () => {
  expect(CHEER_SCAN_ROWS).toBe(MAX_CHEERS_COUNTED * (STICKERS_PER_BUDDY_PER_DAY + 1));
  const rows = Array.from({ length: 40 }, (_, i) => ({ toUserId: `b${i}`, sentAt: new Date(Date.UTC(2026, 9, 1, 0, i)) }));
  expect(cheerTimes(rows, 'UTC')).toHaveLength(15);
});

it('grants each rule kind once, returns the inserted rows, and is idempotent', async () => {
  const u = await buddyUser();
  await level(u.id, 'SLEEP_GOAL', 1, AFTER);
  const first = await grantCosmetics(u.id, NOW, LAUNCH);
  expect(first.map((r) => r.itemId).sort()).toEqual(['art.mountain', 'floor.carpet', 'item.bottle', 'plant.monstera', 'rug.red', 'shelf.trophyB']);
  expect(first.find((r) => r.itemId === 'rug.red')!.source).toBe('family:SLEEP_GOAL:1');
  expect(await grantCosmetics(u.id, NOW, LAUNCH)).toEqual([]);
  expect(await unlocked(u.id)).toHaveLength(6);
});

it('concurrent grants insert each row once and announce each once', async () => {
  const u = await buddyUser();
  await level(u.id, 'STEP_GOAL', 1, AFTER);
  const [a, b] = await Promise.all([grantCosmetics(u.id, NOW, LAUNCH), grantCosmetics(u.id, NOW, LAUNCH)]);
  expect(a.length + b.length).toBe((await unlocked(u.id)).length);
});

it('a recap counter grants the Cottage set; a badge from before launch is stored as backfill', async () => {
  const u = await buddyUser();
  await weekRecaps(u.id, 4, AFTER);
  await level(u.id, 'CHECK_IN', 1, new Date('2026-09-01T00:00:00Z'));
  await grantCosmetics(u.id, NOW, LAUNCH);
  const rows = await unlocked(u.id);
  expect(rows.find((r) => r.itemId === 'set.cottage.desk')!.source).toBe('set:cottage');
  expect(rows.find((r) => r.itemId === 'pet.bed')!.source).toBe('backfill');
});

it('logs a count only, never the user or the items', async () => {
  const u = await buddyUser();
  await level(u.id, 'SLEEP_GOAL', 1, AFTER);
  await grantCosmetics(u.id, NOW, LAUNCH);
  const lines = quiet.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('cosmetics'));
  expect(lines).toEqual([JSON.stringify({ event: 'cosmetics.granted', count: 6 })]);
  expect(lines.join()).not.toContain(u.id);
});

it('grantCosmeticsSafely swallows a failure and logs no user', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const real = cosmeticsHooks.grant;
  cosmeticsHooks.grant = async () => { throw new Error('db down'); };
  try {
    await expect(grantCosmeticsSafely('some-user', NOW)).resolves.toBeUndefined();
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([JSON.stringify({ event: 'cosmetics.grant_failed', error: 'Error' })]);
  } finally {
    cosmeticsHooks.grant = real;
    warn.mockRestore();
  }
});
