// Visits and room cheers (spec 2026-10-15 §10.1, §10.2, §12; P4 rulings 8, 9, 24, 29, 30; T3-FIX carry, T5T7-GATE,
// PF4-F7, PF4-F18).
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { coinsConfig } from '../../src/coins/sources';
import * as ledger from '../../src/coins/ledger';
import { cheerRoom } from '../../src/room/visit';
import { BuddyError } from '../../src/buddies/errors';
import { api, buddyUser } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';
import { level } from '../cosmetics/helpers';
import { openRoom, pairedPair } from '../challenges/helpers';
import { rowsOf } from '../coins/helpers';

const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2026-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const room = async (h: Record<string, string>, id: string) => (await api()).get(`/me/buddies/${id}/room`).set(h);
const cheer = async (h: Record<string, string>, id: string) => (await api()).post(`/me/buddies/${id}/room/cheer`).set(h).send({});

/** Every key at any depth of a JSON body. */
function keysDeep(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  return out;
}

describe('GET /me/buddies/:buddyId/room (spec §10.1, §12)', () => {
  it('shows an open room: the layout, its size, KIP, the week\'s cheers; nothing else, private no-store', async () => {
    const { a, b, ha } = await pairedPair();
    await openRoom(b.id);
    await prisma.cosmeticLoadout.create({ data: { userId: b.id, layout: (await import('../../src/room/convert')).starterLayout() as never, worn: { head: 'out.beanie', face: null, neck: null, ears: null }, tier: 2, version: 1 } });
    await prisma.biometricRecord.create({ data: { userId: b.id, metricType: 'STEPS', value: 4200, recordedAt: new Date() } });
    const res = await room(ha, b.id);
    expect([res.status, res.headers['cache-control']]).toEqual([200, 'private, no-store']);
    expect(Object.keys(res.body).sort()).toEqual(['cheeredToday', 'cheersThisWeek', 'kipColour', 'kipWorn', 'layout', 'name', 'size']);
    expect(res.body).toMatchObject({ name: 'Sam', size: { n: 8, m: 8 }, cheersThisWeek: 0, cheeredToday: false, kipWorn: { head: 'out.beanie' } });
    // Size only: never the tier, a badge, counts, a balance or a living state (spec §10.1).
    expect(JSON.stringify(res.body)).not.toMatch(/tier|living|plantStage|petEnergy|awards|balance|counts|4200/);
    expect(a.id).not.toBe(b.id);
  });

  it('carries exactly the §10.1 keys at every depth: no living, no trophy-shelf awards, no badge (PF4-F7, ruling 24)', async () => {
    const { b, ha } = await pairedPair();
    await openRoom(b.id);
    // The owner has badge levels: their own room body would carry them as living.awards for the trophy shelf.
    await level(b.id, 'SLEEP_GOAL', 3, new Date());
    await prisma.coinWallet.create({ data: { userId: b.id, balance: 77 } });
    const res = await room(ha, b.id);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['cheeredToday', 'cheersThisWeek', 'kipColour', 'kipWorn', 'layout', 'name', 'size']);
    expect(Object.keys(res.body.size).sort()).toEqual(['m', 'n']);
    expect(Object.keys(res.body.kipWorn).sort()).toEqual(['ears', 'face', 'head', 'neck']);
    // The layout is the room exactly as drawn (the starter room here: no row), nothing added to it.
    expect(res.body.layout).toEqual((await import('../../src/room/convert')).starterLayout());
    for (const k of ['living', 'awards', 'plantStage', 'petEnergy', 'tier', 'badges', 'badge', 'balance', 'counts', 'coins']) expect([k, keysDeep(res.body).has(k)]).toEqual([k, false]);
    expect(JSON.stringify(res.body)).not.toMatch(/:77\b/);
  });

  it('is one 404 for visits off, a block either way, not buddies, oneself and a bad id (ruling 8; Review Focus 5)', async () => {
    const { a, b, ha } = await pairedPair();
    const stranger = await buddyUser();
    await openRoom(stranger.id);
    const closed = await room(ha, b.id);
    await openRoom(b.id);
    await prisma.buddyBlock.create({ data: { blockerId: b.id, blockedId: a.id } });
    const blocked = await room(ha, b.id);
    const notBuddies = await room(ha, stranger.id);
    const self = await room(ha, a.id);
    const bad = await room(ha, 'not-a-uuid');
    for (const r of [closed, blocked, notBuddies, self, bad]) expect([r.status, r.body]).toEqual([404, { error: 'not_found' }]);
  });

  it('is the same 404 when the viewer blocked the owner', async () => {
    const { a, b, ha } = await pairedPair();
    await openRoom(b.id);
    await prisma.buddyBlock.create({ data: { blockerId: a.id, blockedId: b.id } });
    const res = await room(ha, b.id);
    expect([res.status, res.body, res.headers['cache-control']]).toEqual([404, { error: 'not_found' }, 'private, no-store']);
  });
});

describe('POST /me/buddies/:buddyId/room/cheer (spec §10.2)', () => {
  it('pays both people 2 coins once a day, counts for the week, and ticks the first-week cheer row (ruling 30)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await openRoom(b.id);
    const first = await cheer(ha, b.id);
    expect([first.status, first.body]).toEqual([200, { paid: true }]);
    const again = await cheer(ha, b.id);
    expect([again.status, again.body]).toEqual([409, { error: 'already_cheered' }]);
    expect((await rowsOf(a.id)).map((r) => [r.kind, r.amount])).toEqual([['cheer_given', 2]]);
    expect((await rowsOf(b.id)).map((r) => [r.kind, r.amount])).toEqual([['cheer_got', 2]]);
    // The keys are the cheer's id, one per side (ruling 9).
    const id = (await prisma.roomCheer.findFirstOrThrow({ where: { fromId: a.id } })).id;
    expect([(await rowsOf(a.id))[0]!.sourceKey, (await rowsOf(b.id))[0]!.sourceKey]).toEqual([`cheer:${id}:given`, `cheer:${id}:got`]);
    expect((await room(ha, b.id)).body).toMatchObject({ cheersThisWeek: 1, cheeredToday: true });
    await prisma.roomFirstWeek.create({ data: { userId: a.id, startedOn: new Date(new Date().toISOString().slice(0, 10)) } });
    const week = await (await api()).get('/me/firstweek').set(ha);
    expect(week.body.tasks.find((t: { key: string }) => t.key === 'cheer')).toMatchObject({ done: true });
    // The owner sees who cheered (spec §10.2).
    const mine = await (await api()).get('/me/room/cheers').set(hb);
    expect(mine.headers['cache-control']).toBe('private, no-store');
    expect(mine.body).toEqual({ count: 1, cheers: [{ name: 'Sam', day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }] });
  });

  it('two buddies cheering each other\'s rooms at once both land (Review Focus 1)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await openRoom(a.id);
    await openRoom(b.id);
    const [x, y] = await Promise.all([cheer(ha, b.id), cheer(hb, a.id)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect((await rowsOf(a.id)).map((r) => r.kind).sort()).toEqual(['cheer_given', 'cheer_got']);
  });

  it('past five paid cheers a day the cheer still counts but pays 0 (spec §10.2)', async () => {
    const { a, ha } = await pairedPair();
    const owners = await Promise.all(Array.from({ length: 6 }, () => buddyUser()));
    for (const o of owners) {
      const [lo, hi] = a.id < o.id ? [a.id, o.id] : [o.id, a.id];
      await prisma.buddyPair.create({ data: { userAId: lo, userBId: hi } });
      await openRoom(o.id);
    }
    const paid = [];
    for (const o of owners) paid.push((await cheer(ha, o.id)).body.paid);
    expect(paid).toEqual([true, true, true, true, true, false]);
    expect(await prisma.roomCheer.count({ where: { fromId: a.id } })).toBe(6);
  });

  it('a closed room can\'t be cheered: the same 404', async () => {
    const { b, ha } = await pairedPair();
    const res = await cheer(ha, b.id);
    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
    expect(await authHeaderFor(b.id)).toBeTruthy();
  });

  it('is the same 404 for oneself, a bad id, a stranger and a block, and writes nothing', async () => {
    const { a, b, ha } = await pairedPair();
    const stranger = await buddyUser();
    await openRoom(stranger.id);
    await openRoom(b.id);
    await openRoom(a.id);
    await prisma.buddyBlock.create({ data: { blockerId: a.id, blockedId: b.id } });
    for (const id of [a.id, 'nope', stranger.id, b.id]) expect([(await cheer(ha, id)).status, (await cheer(ha, id)).body]).toEqual([404, { error: 'not_found' }]);
    expect(await prisma.roomCheer.count({ where: { fromId: a.id } })).toBe(0);
    expect(await rowsOf(a.id)).toEqual([]);
  });

  it('pays nothing before the coins launch day, yet the cheer counts (T5T7-GATE)', async () => {
    const { a, b, ha } = await pairedPair();
    await openRoom(b.id);
    coinsConfig.launchedAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    try {
      const res = await cheer(ha, b.id);
      expect([res.status, res.body]).toEqual([200, { paid: false }]);
    } finally {
      coinsConfig.launchedAt = new Date('2026-01-01T00:00:00.000Z');
    }
    expect([await rowsOf(a.id), await rowsOf(b.id)]).toEqual([[], []]);
    expect(await prisma.roomCheer.count({ where: { fromId: a.id, toId: b.id } })).toBe(1);
  });

  it('takes both users\' locks first, viewer and owner (T3-FIX)', async () => {
    const { a, b } = await pairedPair();
    await openRoom(b.id);
    const spy = jest.spyOn(ledger, 'lockUsers');
    try {
      await cheerRoom(a.id, b.id, new Date());
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![1]).toEqual([a.id, b.id]);
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    ['a lock timeout (P2028)', Object.assign(new Error('Transaction API error'), { name: 'PrismaClientKnownRequestError', code: 'P2028' })],
    ['a deadlock (40P01)', Object.assign(new Error('deadlock detected'), { name: 'PrismaClientKnownRequestError', code: 'P2010', meta: { code: '40P01' } })],
  ])('answers 503 try_later on %s and logs only the event and the error name', async (_what, failure) => {
    const { a, b, ha } = await pairedPair();
    await openRoom(b.id);
    const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(failure);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await cheer(ha, b.id);
      expect([res.status, res.body]).toEqual([503, { error: 'try_later' }]);
      const lines = warn.mock.calls.map((c) => String(c[0]));
      expect(lines).toEqual([JSON.stringify({ event: 'room.cheer_failed', error: 'PrismaClientKnownRequestError' })]);
      expect(lines.join()).not.toContain(a.id);
    } finally {
      tx.mockRestore();
      warn.mockRestore();
    }
  });

  it('rethrows any other failure', async () => {
    const { a, b } = await pairedPair();
    await openRoom(b.id);
    const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new TypeError('boom'));
    try {
      await expect(cheerRoom(a.id, b.id, new Date())).rejects.toThrow(TypeError);
    } finally {
      tx.mockRestore();
    }
    await expect(cheerRoom(a.id, b.id, new Date())).resolves.toEqual({ paid: true });
    await expect(cheerRoom(a.id, b.id, new Date())).rejects.toEqual(new BuddyError('already_cheered'));
  });

  it('takes the 32 KB parser: a bigger body is 400 invalid_body (ruling 29)', async () => {
    const { b, ha } = await pairedPair();
    await openRoom(b.id);
    const res = await (await api()).post(`/me/buddies/${b.id}/room/cheer`).set(ha).send({ pad: 'x'.repeat(40 * 1024) });
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });
});

describe('GET /me/room/cheers (spec §10.2)', () => {
  it('leaves out anyone the owner blocked or who blocked the owner (PF4-F18)', async () => {
    const { a: owner, b: kept, ha: ho, hb: hk } = await pairedPair();
    await openRoom(owner.id);
    const c = await buddyUser({ displayName: 'Cleo' });
    const d = await buddyUser({ displayName: 'Dev' });
    for (const u of [c, d]) {
      const [lo, hi] = owner.id < u.id ? [owner.id, u.id] : [u.id, owner.id];
      await prisma.buddyPair.create({ data: { userAId: lo, userBId: hi } });
    }
    for (const [h, id] of [[hk, owner.id], [await authHeaderFor(c.id), owner.id], [await authHeaderFor(d.id), owner.id]] as const) {
      expect((await cheer(h, id)).status).toBe(200);
    }
    expect((await (await api()).get('/me/room/cheers').set(ho)).body.count).toBe(3);
    await prisma.buddyBlock.create({ data: { blockerId: owner.id, blockedId: c.id } });
    await prisma.buddyBlock.create({ data: { blockerId: d.id, blockedId: owner.id } });
    const res = await (await api()).get('/me/room/cheers').set(ho);
    expect(res.body).toEqual({ count: 1, cheers: [{ name: 'Sam', day: expect.any(String) }] });
    expect(kept.id).not.toBe(owner.id);
  });

  it('is empty with no cheers', async () => {
    const { ha } = await pairedPair();
    const res = await (await api()).get('/me/room/cheers').set(ha);
    expect([res.status, res.body]).toEqual([200, { count: 0, cheers: [] }]);
  });
});
