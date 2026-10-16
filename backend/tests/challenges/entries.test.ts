// Weekly theme challenges (spec 2026-10-15 §10.4, §12; P4 rulings 4-7, 10; T5T7-GATE, PF4-F18).
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { coinsConfig } from '../../src/coins/sources';
import * as ledger from '../../src/coins/ledger';
import { challengeClock, closesAt, resultsAt, weekOf } from '../../src/challenges/week';
import { cheerEntry, enterChallenge, readChallenge } from '../../src/challenges/entries';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';
import { piece, withPieces } from '../room/helpers';
import { rowsOf } from '../coins/helpers';
import { openRoom, pairedPair } from './helpers';

const CLOCK = challengeClock.now;
const LAUNCH = coinsConfig.launchedAt;
const LAUNCHED = new Date('2026-01-01T00:00:00.000Z');
beforeAll(() => {
  migrateTestDb();
  // The Jest setup parks the coins launch in 2100 (setupEnv); these tests pay coins.
  coinsConfig.launchedAt = LAUNCHED;
});
afterAll(async () => {
  challengeClock.now = CLOCK;
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const WED = new Date('2026-10-28T12:00:00.000Z'); // 2026-W44, Cosy autumn
const warm = withPieces(piece('p1', 'corner.pumpkin', { x: 6, y: 6 }), piece('p2', 'corner.pumpkin', { x: 5, y: 6 }));
const save = async (userId: string, layout: unknown, version: number) =>
  (await api()).put('/me/cosmetics').set(await authHeaderFor(userId)).send({ layout, worn: { ...EMPTY_WORN }, version });
const buyPumpkins = (userId: string) => prisma.itemGrant.create({ data: { userId, itemId: 'corner.pumpkin', qty: 2, sourceKey: `buy:pk-${userId}` } });

it('weeks close at each entrant\'s own Sunday 20:00; results from Monday 08:00 UTC (ruling 5; Review Focus 3)', () => {
  expect(weekOf(WED, 'Pacific/Auckland')).toBe('2026-W44');
  expect(closesAt('2026-W44', 'Pacific/Auckland').toISOString()).toBe('2026-11-01T07:00:00.000Z');
  // 1 November 2026 is also the day Los Angeles leaves daylight time: 20:00 PST is 04:00 UTC on the Monday.
  expect(closesAt('2026-W44', 'America/Los_Angeles').toISOString()).toBe('2026-11-02T04:00:00.000Z');
  expect(resultsAt('2026-W44').toISOString()).toBe('2026-11-02T08:00:00.000Z');
});

it('no challenge before the first theme week: 404 no_challenge', async () => {
  const u = await buddyUser();
  await expect(enterChallenge(u.id, new Date('2026-10-20T12:00:00.000Z'))).rejects.toMatchObject({ code: 'no_challenge' });
});

it('entering after the entrant\'s own close is 409 challenge_closed, and writes nothing', async () => {
  const u = await buddyUser();
  await expect(enterChallenge(u.id, new Date('2026-11-01T20:00:00.000Z'))).rejects.toMatchObject({ code: 'challenge_closed' });
  expect(await prisma.challengeEntry.count({ where: { userId: u.id } })).toBe(0);
});

it('entering snapshots the room; +30 pays once, at entry when it meets the brief (spec §10.4)', async () => {
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await prisma.cosmeticLoadout.create({ data: { userId: u.id, layout: warm as never, worn: { ...EMPTY_WORN }, version: 1 } });
  const dto = await enterChallenge(u.id, WED);
  expect(dto).toMatchObject({ week: '2026-W44', theme: { id: 'cosyAutumn', tag: 'warm', atLeast: 3 }, open: true, entry: { meets: true, paid: true } });
  await enterChallenge(u.id, WED);
  expect((await rowsOf(u.id)).filter((r) => r.kind === 'challenge').map((r) => [r.sourceKey, r.amount])).toEqual([['challenge:2026-W44', 30]]);
  expect(quiet.mock.calls.map(([l]) => l)).toContain(JSON.stringify({ event: 'challenge.entered' }));
  // Logged once, with the event name only.
  expect(quiet.mock.calls.filter(([l]) => String(l).includes('challenge.entered'))).toHaveLength(1);
  const entry = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
  expect(Object.keys(entry.snapshot as object).sort()).toEqual(['layout', 'size']);
  expect((entry.snapshot as { size: unknown }).size).toEqual({ n: 7, m: 7 });
});

it('a later save that brings the entry up to the brief pays then; a save after the close changes nothing', async () => {
  challengeClock.now = () => WED;
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await enterChallenge(u.id, WED); // the starter room: the amber lamp and the mug, 2 warm pieces
  expect((await readChallenge(u.id, WED)).entry).toEqual({ count: 2, meets: false, paid: false });
  expect((await save(u.id, warm, 0)).status).toBe(200);
  const entry = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
  expect((entry.snapshot as { layout: { pieces: unknown[] } }).layout.pieces).toHaveLength(warm.pieces.length);
  expect(Object.keys(entry.snapshot as object).sort()).toEqual(['layout', 'size']);
  expect(entry.paidAt).not.toBeNull();
  expect((await rowsOf(u.id)).filter((r) => r.kind === 'challenge').map((r) => r.amount)).toEqual([30]);
  challengeClock.now = () => new Date('2026-11-01T21:00:00.000Z'); // after UTC's Sunday 20:00
  expect((await save(u.id, withPieces(), 1)).status).toBe(200);
  const after = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
  expect((after.snapshot as { layout: { pieces: unknown[] } }).layout.pieces).toHaveLength(warm.pieces.length);
  challengeClock.now = CLOCK;
});

it('a save with no entry writes no entry, and saves still answer as before', async () => {
  challengeClock.now = () => WED;
  const u = await buddyUser();
  try {
    expect((await save(u.id, withPieces(), 0)).status).toBe(200);
    expect(await prisma.challengeEntry.count({ where: { userId: u.id } })).toBe(0);
  } finally {
    challengeClock.now = CLOCK;
  }
});

it('a save keeps the circle current while the entry is open (ruling 6)', async () => {
  challengeClock.now = () => WED;
  const u = await buddyUser();
  try {
    await enterChallenge(u.id, WED);
    const later = await buddyUser();
    await pairUp(u.id, later.id);
    expect((await save(u.id, withPieces(), 0)).status).toBe(200);
    const entry = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
    expect(entry.circle).toEqual([later.id]);
  } finally {
    challengeClock.now = CLOCK;
  }
});

it('a failed +30 is paid by the next entry read (ruling 7)', async () => {
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await prisma.cosmeticLoadout.create({ data: { userId: u.id, layout: warm as never, worn: { ...EMPTY_WORN }, version: 1 } });
  const timeout = Object.assign(new Error('timeout'), { name: 'PrismaClientKnownRequestError', code: 'P2028' });
  // Twice: the entry's own pay, then the retry in the read that answers the entry.
  const spy = jest.spyOn(ledger, 'applyCoinEvents').mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect((await enterChallenge(u.id, WED)).entry).toEqual({ count: 4, meets: true, paid: false });
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual(Array(2).fill(JSON.stringify({ event: 'coins.earn_failed', error: 'PrismaClientKnownRequestError' })));
  } finally {
    spy.mockRestore();
    warn.mockRestore();
  }
  expect((await readChallenge(u.id, WED)).entry).toEqual({ count: 4, meets: true, paid: true });
  expect((await rowsOf(u.id)).map((r) => [r.kind, r.amount])).toEqual([['challenge', 30]]);
});

it('pays no +30 before the coins launch day (T5T7-GATE: no backpay)', async () => {
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await prisma.cosmeticLoadout.create({ data: { userId: u.id, layout: warm as never, worn: { ...EMPTY_WORN }, version: 1 } });
  coinsConfig.launchedAt = new Date('2026-10-29T00:00:00.000Z'); // the day after WED
  try {
    expect((await enterChallenge(u.id, WED)).entry).toEqual({ count: 4, meets: true, paid: false });
    expect((await readChallenge(u.id, WED)).entry?.paid).toBe(false);
  } finally {
    coinsConfig.launchedAt = LAUNCHED;
  }
  expect(await rowsOf(u.id)).toEqual([]);
  expect((await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } })).paidAt).toBeNull();
});

it('buddies see an entry even with visits off; the visit stays closed (controller ruling, §10.4)', async () => {
  const { a, b, ha } = await pairedPair();
  await enterChallenge(b.id, WED);
  const seen = await readChallenge(a.id, WED);
  expect(seen.entries.map((e) => [e.userId, e.mine, e.cheers])).toEqual([[b.id, false, 0]]);
  expect(Object.keys(seen.entries[0]!.snapshot).sort()).toEqual(['layout', 'size']);
  expect(JSON.stringify(seen)).not.toMatch(/tier|living|balance|counts|badges/);
  expect((await (await api()).get(`/me/buddies/${b.id}/room`).set(ha)).status).toBe(404);
});

it('strangers never see an entry; anyone blocked either way is left out (PF4-F18)', async () => {
  const me = await buddyUser();
  const kept = await buddyUser({ displayName: 'Kai' });
  const iBlocked = await buddyUser();
  const blockedMe = await buddyUser();
  const stranger = await buddyUser();
  for (const u of [kept, iBlocked, blockedMe]) await pairUp(me.id, u.id);
  for (const u of [kept, iBlocked, blockedMe, stranger]) await enterChallenge(u.id, WED);
  await prisma.buddyBlock.create({ data: { blockerId: me.id, blockedId: iBlocked.id } });
  await prisma.buddyBlock.create({ data: { blockerId: blockedMe.id, blockedId: me.id } });
  expect((await readChallenge(me.id, WED)).entries.map((e) => [e.userId, e.name])).toEqual([[kept.id, 'Kai']]);
});

it('entry cheers: buddies only, never your own, once, only before the entrant\'s own close (ruling 10; Review Focus 3)', async () => {
  const nz = await buddyUser({ timezone: 'Pacific/Auckland' });
  const la = await buddyUser({ timezone: 'America/Los_Angeles' });
  const fan = await buddyUser();
  await pairUp(fan.id, nz.id);
  await pairUp(fan.id, la.id);
  await enterChallenge(nz.id, WED);
  await enterChallenge(la.id, WED);
  await expect(cheerEntry(nz.id, nz.id, WED)).rejects.toMatchObject({ code: 'not_found' });
  await expect(cheerEntry(nz.id, la.id, WED)).rejects.toMatchObject({ code: 'not_found' }); // not buddies
  expect(await cheerEntry(fan.id, nz.id, WED)).toEqual({ paid: true });
  await expect(cheerEntry(fan.id, nz.id, WED)).rejects.toMatchObject({ code: 'already_cheered' });
  const sunday = new Date('2026-11-01T10:00:00.000Z'); // after Auckland's close, before Los Angeles'
  await expect(cheerEntry(fan.id, la.id, new Date('2026-11-02T05:00:00.000Z'))).rejects.toMatchObject({ code: 'challenge_closed' });
  expect(await cheerEntry(fan.id, la.id, sunday)).toEqual({ paid: true });
  expect((await rowsOf(nz.id)).filter((r) => r.kind === 'cheer_got').map((r) => r.sourceKey)).toEqual([`ccheer:2026-W44:${fan.id}:${nz.id}:got`]);
  expect((await rowsOf(fan.id)).map((r) => [r.kind, r.amount]).sort()).toEqual([['cheer_given', 2], ['cheer_given', 2]]);
  // The fan sees the count and their own cheer on the entry.
  expect((await readChallenge(fan.id, WED)).entries.find((e) => e.userId === nz.id)).toMatchObject({ cheers: 1, cheeredByMe: true });
});

it('an entry cheer after a block either way is the uniform 404; a buddy with no entry too', async () => {
  const { a, b } = await pairedPair();
  await expect(cheerEntry(a.id, b.id, WED)).rejects.toMatchObject({ code: 'not_found' });
  await enterChallenge(b.id, WED);
  await prisma.buddyBlock.create({ data: { blockerId: b.id, blockedId: a.id } });
  await expect(cheerEntry(a.id, b.id, WED)).rejects.toMatchObject({ code: 'not_found' });
  await expect(cheerEntry(a.id, 'not-a-uuid', WED)).rejects.toMatchObject({ code: 'not_found' });
  expect(await prisma.challengeCheer.count({ where: { fromId: a.id } })).toBe(0);
});

it('an entry cheer before the coins launch day counts but pays nothing (T5T7-GATE)', async () => {
  const { a, b } = await pairedPair();
  await enterChallenge(b.id, WED);
  coinsConfig.launchedAt = new Date('2026-10-29T00:00:00.000Z');
  try {
    expect(await cheerEntry(a.id, b.id, WED)).toEqual({ paid: false });
  } finally {
    coinsConfig.launchedAt = LAUNCHED;
  }
  expect([await rowsOf(a.id), await rowsOf(b.id)]).toEqual([[], []]);
  expect(await prisma.challengeCheer.count({ where: { fromId: a.id, toId: b.id } })).toBe(1);
});

it('an entry cheer takes both users\' locks first (lockUsers contract)', async () => {
  const { a, b } = await pairedPair();
  await enterChallenge(b.id, WED);
  const spy = jest.spyOn(ledger, 'lockUsers');
  try {
    await cheerEntry(a.id, b.id, WED);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1]).toEqual([a.id, b.id]);
  } finally {
    spy.mockRestore();
  }
});

it.each([
  ['a lock timeout (P2028)', Object.assign(new Error('Transaction API error'), { name: 'PrismaClientKnownRequestError', code: 'P2028' })],
  ['a deadlock (40P01)', Object.assign(new Error('deadlock detected'), { name: 'PrismaClientKnownRequestError', code: 'P2010', meta: { code: '40P01' } })],
  ['a write conflict or deadlock (P2034)', Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), { name: 'PrismaClientKnownRequestError', code: 'P2034' })],
])('an entry cheer answers 503 try_later on %s and logs only the event and the error name', async (_what, failure) => {
  const { a, b, ha } = await pairedPair();
  await enterChallenge(b.id, WED);
  challengeClock.now = () => WED;
  const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(failure);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const res = await (await api()).post(`/me/challenge/entries/${b.id}/cheer`).set(ha).send({});
    expect([res.status, res.body]).toEqual([503, { error: 'try_later' }]);
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines).toEqual([JSON.stringify({ event: 'challenge.cheer_failed', error: failure.name })]);
    expect(lines.join()).not.toContain(a.id);
  } finally {
    tx.mockRestore();
    warn.mockRestore();
    challengeClock.now = CLOCK;
  }
});

it('the routes answer private no-store and refuse an unknown entrant with the uniform 404', async () => {
  challengeClock.now = () => WED;
  const { a, b, ha } = await pairedPair();
  await openRoom(b.id);
  const get = await (await api()).get('/me/challenge').set(ha);
  expect([get.status, get.headers['cache-control'], get.body.theme?.id]).toEqual([200, 'private, no-store', 'cosyAutumn']);
  const entered = await (await api()).post('/me/challenge/entry').set(ha).send({});
  expect([entered.status, entered.body.entry?.paid]).toEqual([200, false]);
  const cheer = await (await api()).post(`/me/challenge/entries/${b.id}/cheer`).set(ha).send({});
  expect([cheer.status, cheer.body]).toEqual([404, { error: 'not_found' }]); // b has no entry
  expect(a.id).not.toBe(b.id);
  challengeClock.now = CLOCK;
});

it('the routes need a session, and the POSTs take the 32 KB parser (ruling 29)', async () => {
  challengeClock.now = () => WED;
  const { b, ha } = await pairedPair();
  try {
    expect((await (await api()).get('/me/challenge')).status).toBe(401);
    const big = { pad: 'x'.repeat(40 * 1024) };
    expect([(await (await api()).post('/me/challenge/entry').set(ha).send(big)).body]).toEqual([{ error: 'invalid_body' }]);
    expect([(await (await api()).post(`/me/challenge/entries/${b.id}/cheer`).set(ha).send(big)).body]).toEqual([{ error: 'invalid_body' }]);
  } finally {
    challengeClock.now = CLOCK;
  }
});
