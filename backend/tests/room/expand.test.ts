import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import * as evaluate from '../../src/achievements/evaluate';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { coinsConfig } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { starterLayout } from '../../src/room/convert';
import { parseExpand } from '../../src/room/expand';
import { shiftDate } from '../../src/scoring/dates';
import { day, level } from '../cosmetics/helpers';
import { balance, coinUser, fund, rowsOf } from '../coins/helpers';
import { piece } from './helpers';

// Nothing earns in these tests (a first placement would pay its +10 once the real launch date has passed).
const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2100-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

const grow = async (headers: Record<string, string>, toTier: number, requestId: string = randomUUID()) =>
  (await api()).post('/me/room/expand').set(headers).send({ requestId, toTier });
const save = async (headers: Record<string, string>, layout: unknown, version: number) =>
  (await api()).put('/me/cosmetics').set(headers).send({ layout, worn: { ...EMPTY_WORN }, version });
const SOON = () => new Date(Date.now() - 1000);
const logged = (event: string) => info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes(event));

describe('POST /me/room/expand (spec §7, §12)', () => {
  it('needs both gates: no coins and no badge, coins alone, a badge alone each answer 409 gate with what is missing', async () => {
    const a = await coinUser();
    expect([(await grow(a.headers, 2)).status, (await grow(a.headers, 2)).body]).toEqual([409, { error: 'gate', coinsNeeded: 600, badgeNeeded: true }]);
    await fund(a.user.id, 600);
    expect((await grow(a.headers, 2)).body).toEqual({ error: 'gate', coinsNeeded: 0, badgeNeeded: true });
    const b = await coinUser();
    await level(b.user.id, 'CHECK_IN', 2, SOON());
    expect((await grow(b.headers, 2)).body).toEqual({ error: 'gate', coinsNeeded: 600, badgeNeeded: false });
    expect((await rowsOf(a.user.id)).filter((r) => r.kind === 'expand')).toEqual([]);
  });

  it('with both, grows to 8 × 8: spends 600 (seen), creates the row at version 1, answers the GET body with the balance and stored 0', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 650);
    await level(user.id, 'CHECK_IN', 2, SOON()); // a stored level; no check-in run at all: it never re-locks
    const res = await grow(headers, 2);
    expect([res.status, res.headers['cache-control'], res.body.tier, res.body.cap, res.body.version, res.body.balance, res.body.stored, res.body.layout])
      .toEqual([200, 'private, no-store', 2, 60, 1, 50, 0, starterLayout()]);
    expect(res.body).toEqual(expect.objectContaining({ counts: expect.any(Object), worn: { ...EMPTY_WORN }, welcomed: false }));
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'expand').map((r) => [r.amount, r.seenAt instanceof Date])).toEqual([[-600, true]]);
    const lines = logged('room.expanded');
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'room.expanded', tier: 2 }]);
    expect(lines.join('')).not.toContain(user.id);
    // The spend's kind only (ruling T6T7-REPLAY): no id, no amount.
    expect(logged('coins.spent').map((l) => JSON.parse(l))).toEqual([{ event: 'coins.spent', kind: 'expand' }]);
  });

  it('a repeated request id answers the grown room again with the CURRENT balance, without spending twice (PF-F9)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 650);
    await level(user.id, 'CHECK_IN', 2, SOON());
    const id = randomUUID();
    await grow(headers, 2, id);
    await fund(user.id, 10);
    info.mockClear();
    const again = await grow(headers, 2, id);
    expect([again.status, again.body.tier, again.body.version, again.body.balance, again.body.stored]).toEqual([200, 2, 1, 60, 0]);
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'expand')).toHaveLength(1);
    expect([logged('coins.spent'), logged('room.expanded')]).toEqual([[], []]);
  });

  it('a request id reused for another size is 400 invalid_body and spends nothing (ruling T6-FIX)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 2100);
    await level(user.id, 'CHECK_IN', 2, SOON());
    await level(user.id, 'SLEEP_GOAL', 3, SOON());
    const id = randomUUID();
    expect((await grow(headers, 2, id)).status).toBe(200);
    const reused = await grow(headers, 3, id);
    expect([reused.status, reused.body]).toEqual([400, { error: 'invalid_body' }]);
    expect([await balance(user.id), (await rowsOf(user.id)).filter((r) => r.kind === 'expand').length]).toEqual([1500, 1]);
    expect((await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } }))!.tier).toBe(2);
  });

  it('409 stale_tier for anything but the next size; a save never changes the size', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 2100);
    await level(user.id, 'CHECK_IN', 2, SOON());
    await level(user.id, 'SLEEP_GOAL', 3, SOON());
    expect((await grow(headers, 3)).body).toEqual({ error: 'stale_tier' });
    expect((await grow(headers, 2)).status).toBe(200);
    expect((await grow(headers, 2)).body).toEqual({ error: 'stale_tier' });
    const put = await save(headers, starterLayout(), 1);
    expect([put.status, put.body.tier]).toEqual([200, 2]);
  });

  it('to the loft: stores the wall pieces the new window covers, with what stands on them, and bumps the version (Review Focus 4)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 2100);
    await level(user.id, 'CHECK_IN', 2, SOON());
    await level(user.id, 'SLEEP_GOAL', 3, SOON());
    expect((await grow(headers, 2)).body.version).toBe(1);
    // The plank (with its books) moved to right-wall half-tile 12, where the loft's window will be; the calendar at 0.
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces.map((p) => (p.id === 'plank' ? { ...p, x: 12 } : p)), piece('cal', 'art.calendar', { layer: 'wallR', x: 0, y: 9 })] };
    expect((await save(headers, layout, 1)).status).toBe(200);
    const res = await grow(headers, 3);
    expect([res.status, res.body.tier, res.body.cap, res.body.version, res.body.stored, res.body.balance]).toEqual([200, 3, 90, 3, 2, 0]);
    const ids = res.body.layout.pieces.map((p: { id: string }) => p.id);
    expect([ids.includes('plank'), ids.includes('shelf'), ids.includes('cal')]).toEqual([false, false, true]);
    expect([res.body.counts['shelf.plank'], res.body.counts['shelf.books']]).toEqual([1, 1]); // back in the inventory
  });

  it('evaluates the badge family first: a 14-day run reached since the last badge load opens the gate (ruling 18)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 600);
    const today = habitDayFor(new Date(), 'UTC');
    await prisma.user.update({ where: { id: user.id }, data: { achievementsSince: day(shiftDate(today, -20)) } });
    for (let k = 1; k <= 14; k++) await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(shiftDate(today, -k)), onTime: true } });
    expect((await grow(headers, 2)).status).toBe(200);
  });

  it('a failed badge evaluation is logged by its error name only and the stored levels still decide (PF-F11)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 600);
    await level(user.id, 'CHECK_IN', 2, SOON());
    const failing = jest.spyOn(evaluate, 'evaluateAchievements').mockRejectedValueOnce(new TypeError('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect((await grow(headers, 2)).status).toBe(200);
      expect(failing).toHaveBeenCalledWith(user.id, expect.any(Date), ['CHECK_IN']);
      expect(warn.mock.calls.map((c) => JSON.parse(String(c[0])))).toEqual([{ event: 'room.expand_badges_failed', error: 'TypeError' }]);
    } finally {
      failing.mockRestore();
      warn.mockRestore();
    }
  });

  it('a save and a grow at once never interleave: a save that lost the race answers 409 stale', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 600);
    await level(user.id, 'CHECK_IN', 2, SOON());
    expect((await save(headers, starterLayout(), 0)).status).toBe(200);
    const [put, g] = await Promise.all([save(headers, starterLayout(), 1), grow(headers, 2)]);
    expect(g.status).toBe(200);
    expect([200, 409]).toContain(put.status);
    const row = (await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } }))!;
    expect([row.tier, row.version]).toEqual([2, put.status === 200 ? 3 : 2]);
  });

  it('two grows with different request ids at once: one grows, the other is stale_tier, one spend', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 1200);
    await level(user.id, 'CHECK_IN', 2, SOON());
    const res = await Promise.all([grow(headers, 2), grow(headers, 2)]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(res.find((r) => r.status === 409)!.body).toEqual({ error: 'stale_tier' });
    expect([await balance(user.id), (await rowsOf(user.id)).filter((r) => r.kind === 'expand').length]).toEqual([600, 1]);
  });

  it('400 invalid_body for a bad shape or a body over 32 KB, and needs a session', async () => {
    const { headers } = await coinUser();
    for (const body of [{ toTier: 2 }, { requestId: 'x', toTier: 2 }, { requestId: randomUUID(), toTier: 4 }, { requestId: randomUUID(), toTier: 2, more: 1 }]) {
      expect((await (await api()).post('/me/room/expand').set(headers).send(body)).body).toEqual({ error: 'invalid_body' });
    }
    const big = await (await api()).post('/me/room/expand').set(headers).send({ requestId: randomUUID(), toTier: 2, pad: 'x'.repeat(40 * 1024) });
    expect([big.status, big.body, big.headers['cache-control']]).toEqual([400, { error: 'invalid_body' }, 'private, no-store']);
    expect((await (await api()).post('/me/room/expand').send({})).status).toBe(401);
  });

  it('parseExpand takes exactly a uuid request id and a size above the starter room', () => {
    const id = randomUUID();
    expect([parseExpand({ requestId: id, toTier: 3 }), parseExpand({ requestId: id, toTier: 1 }), parseExpand([id, 2]), parseExpand(null)])
      .toEqual([{ requestId: id, toTier: 3 }, null, null, null]);
  });
});
