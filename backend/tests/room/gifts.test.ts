// Gifts of spare pieces (spec 2026-10-15 §10.3, §2.2, §12; P4 rulings 11-13, 15, 16; PF4-F4; T6-CARRY).
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { deleteUserAccount } from '../../src/users/deletion';
import { BuddyError } from '../../src/buddies/errors';
import { orderedPair } from '../../src/buddies/pairs';
import { GIFTS_PER_DAY, parseGift, returnGiftsTx, sendGift } from '../../src/room/gifts';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';
import { pairedPair } from '../challenges/helpers';
import { fund } from '../coins/helpers';
import { piece, withPieces } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const noop = { deleteSubscription: async () => {}, revokeToken: async () => {}, log: () => {} };
/** One more fern for a user (a bought copy), so the starter fern has a spare. */
const extraFern = (userId: string) => prisma.itemGrant.create({ data: { userId, itemId: 'plant.fern', qty: 1, sourceKey: `buy:${randomUUID()}` } });
const send = async (h: Record<string, string>, to: string, body: object) => (await api()).post(`/me/buddies/${to}/gifts`).set(h).send(body);
const gift = (over: object = {}) => ({ requestId: randomUUID(), itemId: 'plant.fern', note: 'cosy', ...over });
const ferns = async (userId: string) => 1 + ((await prisma.itemGrant.aggregate({ where: { userId, itemId: 'plant.fern' }, _sum: { qty: true } }))._sum.qty ?? 0);

describe('POST /me/buddies/:buddyId/gifts', () => {
  it('sends a spare: the sender\'s count drops at once; a retry is the same gift (ruling 11)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    const res = await send(ha, b.id, body);
    expect([res.status, res.body, res.headers['cache-control']]).toEqual([201, { id: body.requestId, counts: expect.objectContaining({ 'plant.fern': 1 }) }, 'private, no-store']);
    const again = await send(ha, b.id, body);
    expect([again.status, again.body.id]).toEqual([201, body.requestId]);
    expect(await prisma.itemGrant.count({ where: { userId: a.id, sourceKey: `gift_out:${body.requestId}` } })).toBe(1);
    const other = await send(ha, b.id, { ...body, itemId: 'plant.cactus' });
    expect([other.status, other.body]).toEqual([400, { error: 'invalid_body' }]);
    // The log carries the event name only: no user id, no item, no count (spec §12).
    const lines = quiet.mock.calls.map(([line]) => String(line));
    expect(lines.filter((l) => l.includes('gift.sent'))).toEqual([JSON.stringify({ event: 'gift.sent' })]);
    expect(lines.join()).not.toContain(a.id);
  });

  it('only a spare: the last copy, or a copy that is placed, is 403 not_spare', async () => {
    const { b, ha } = await pairedPair();
    const res = await send(ha, b.id, gift()); // one fern, placed in the starter room
    expect([res.status, res.body]).toEqual([403, { error: 'not_spare' }]);
    const style = await send(ha, b.id, gift({ itemId: 'wall.plain' }));
    expect([style.status, style.body]).toEqual([400, { error: 'invalid_body' }]);
    const typed = await send(ha, b.id, gift({ note: 'hello there' }));
    expect([typed.status, typed.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('a trophy is never a spare, even a second copy from a repeated theme (FINAL-M3)', async () => {
    const { a, b, ha } = await pairedPair();
    await prisma.itemGrant.createMany({ data: ['2026-W44', '2026-W48'].map((w) => ({ userId: a.id, itemId: 'corner.acorn', qty: 1, sourceKey: `prize:${w}` })) });
    const res = await send(ha, b.id, gift({ itemId: 'corner.acorn' }));
    expect([res.status, res.body]).toEqual([403, { error: 'not_spare' }]);
    expect(await prisma.gift.count({ where: { fromId: a.id } })).toBe(0);
  });

  it('a recipient deleted mid-send (P2003) is 403 not_buddies, never a bare 500 (FINAL-M10)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const fk = Object.assign(new Error('Foreign key constraint violated'), { name: 'PrismaClientKnownRequestError', code: 'P2003' });
    const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(fk);
    try {
      const res = await send(ha, b.id, gift());
      expect([res.status, res.body]).toEqual([403, { error: 'not_buddies' }]);
    } finally {
      tx.mockRestore();
    }
  });

  it('counts a copy the read trim hides as placed: the stored layout decides (ruling 11)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    // Two ferns owned and two placed in the stored row: no spare, though a read would show both.
    await prisma.cosmeticLoadout.create({ data: { userId: a.id, layout: withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 })) as never, worn: { ...EMPTY_WORN }, version: 1 } });
    expect((await send(ha, b.id, gift())).body).toEqual({ error: 'not_spare' });
    // A third copy: now one is spare.
    await extraFern(a.id);
    expect((await send(ha, b.id, gift())).status).toBe(201);
  });

  it(`${GIFTS_PER_DAY} a day, buddies only, blocks both ways (spec §10.3)`, async () => {
    const { a, b, ha } = await pairedPair();
    await prisma.itemGrant.create({ data: { userId: a.id, itemId: 'plant.fern', qty: 4, sourceKey: `buy:${randomUUID()}` } });
    for (let k = 0; k < 3; k++) expect((await send(ha, b.id, gift())).status).toBe(201);
    const fourth = await send(ha, b.id, gift());
    expect([fourth.status, fourth.body]).toEqual([429, { error: 'gift_limit' }]);
    await prisma.buddyBlock.create({ data: { blockerId: b.id, blockedId: a.id } });
    expect((await send(ha, b.id, gift())).body).toEqual({ error: 'not_buddies' });
  });

  it('is not_buddies for a stranger, oneself, a bad id, and when the sender blocked the recipient', async () => {
    const { a, b, ha } = await pairedPair();
    const { b: stranger } = await pairedPair();
    await extraFern(a.id);
    for (const id of [stranger.id, a.id, 'nope']) expect([id, (await send(ha, id, gift())).body]).toEqual([id, { error: 'not_buddies' }]);
    await prisma.buddyBlock.create({ data: { blockerId: a.id, blockedId: b.id } });
    expect((await send(ha, b.id, gift())).body).toEqual({ error: 'not_buddies' });
    expect(await prisma.gift.count({ where: { fromId: a.id } })).toBe(0);
  });

  it('a gift racing a save that places the last spare: exactly one wins (spec §2.2; Review Focus 2)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const layout = withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 }));
    const [saved, sent] = await Promise.all([
      (await api()).put('/me/cosmetics').set(ha).send({ layout, worn: { ...EMPTY_WORN }, version: 0 }),
      send(ha, b.id, gift()),
    ]);
    // Either the save lands and the gift is not_spare, or the gift lands and the save is not_owned (Review Focus 2).
    const outcome = saved.status === 200 ? [saved.status, sent.status, sent.body.error] : [sent.status, saved.status, saved.body.error];
    expect([[200, 403, 'not_spare'], [201, 403, 'not_owned']]).toContainEqual(outcome);
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: a.id } });
    const owned = 2 + (await prisma.itemGrant.aggregate({ where: { userId: a.id, sourceKey: { startsWith: 'gift_out:' } }, _sum: { qty: true } }))._sum.qty!;
    const placed = row ? (row.layout as { pieces: Array<{ item: string }> }).pieces.filter((p) => p.item === 'plant.fern').length : 1;
    expect(placed).toBeLessThanOrEqual(owned);
  });

  it('a gift racing an unpair waits on the pair row and is refused, never left between non-buddies (PF4-F4)', async () => {
    const { a, b } = await pairedPair();
    await extraFern(a.id);
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let removed!: () => void;
    const deleted = new Promise<void>((r) => { removed = r; });
    // An unpair caught between its pair delete and its commit: its own return pass has already run.
    const unpairing = prisma.$transaction(async (tx) => {
      await tx.buddyPair.deleteMany({ where: orderedPair(a.id, b.id) });
      await returnGiftsTx(tx, a.id, b.id, new Date());
      removed();
      await held;
    }, { timeout: 20_000 });
    await deleted;
    const sending = sendGift(a.id, b.id, gift(), new Date()).then(() => 'sent', (e: unknown) => (e instanceof BuddyError ? e.code : String(e)));
    const early = await Promise.race([sending, new Promise((r) => setTimeout(() => r('waiting'), 500))]);
    release();
    await unpairing;
    expect([early, await sending]).toEqual(['waiting', 'not_buddies']);
    expect([await prisma.gift.count({ where: { fromId: a.id } }), await ferns(a.id)]).toEqual([0, 2]);
  });

  it('a gift sent at the same moment as a block or an unpair is refused or returned, never stranded (PF4-F4)', async () => {
    for (const end of ['unpair', 'block', 'unpair', 'block'] as const) {
      const { a, b, ha, hb } = await pairedPair();
      await extraFern(a.id);
      const ending = end === 'unpair' ? (await api()).delete(`/me/buddies/${a.id}`).set(hb) : (await api()).post(`/me/buddies/${a.id}/block`).set(hb).send({});
      const [sent, ended] = await Promise.all([send(ha, b.id, gift()), ending]);
      expect([end, ended.status < 300, [201, 403].includes(sent.status)]).toEqual([end, true, true]);
      expect(await prisma.gift.count({ where: { fromId: a.id, returnedAt: null } })).toBe(0);
      expect(await ferns(a.id)).toBe(2);
    }
  });

  it('answers 503 try_later when the transaction loses its lock wait or deadlocks, and writes nothing', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    for (const failure of [
      Object.assign(new Error('Transaction API error'), { code: 'P2028' }),
      Object.assign(new Error('write conflict'), { code: 'P2034' }),
    ]) {
      const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(failure);
      try {
        const res = await send(ha, b.id, gift());
        expect([res.status, res.body]).toEqual([503, { error: 'try_later' }]);
      } finally {
        tx.mockRestore();
      }
    }
    expect(await prisma.gift.count({ where: { fromId: a.id } })).toBe(0);
  });

  it('logs a lost lock wait or a deadlock as gift.send_failed with the error name only (T7-CARRY)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(Object.assign(new Error('deadlock detected'), { name: 'PrismaClientKnownRequestError', code: 'P2010', meta: { code: '40P01' } }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect((await send(ha, b.id, gift())).status).toBe(503);
      const lines = warn.mock.calls.map((c) => String(c[0]));
      expect(lines).toEqual([JSON.stringify({ event: 'gift.send_failed', error: 'PrismaClientKnownRequestError' })]);
      expect(lines.join()).not.toContain(a.id);
    } finally {
      tx.mockRestore();
      warn.mockRestore();
    }
  });

  it('a request id reused for another recipient is 400 invalid_body; a changed note is the same gift (ruling 11; T7-CARRY)', async () => {
    const { a, b, ha } = await pairedPair();
    const c = await buddyUser();
    await pairUp(a.id, c.id);
    await extraFern(a.id);
    await extraFern(a.id);
    const body = gift();
    expect((await send(ha, b.id, body)).status).toBe(201);
    const other = await send(ha, c.id, body);
    expect([other.status, other.body]).toEqual([400, { error: 'invalid_body' }]);
    // The note is not part of a gift's identity: a retry whose note changed answers the same gift, unchanged.
    const renoted = await send(ha, b.id, { ...body, note: 'thought' });
    expect([renoted.status, renoted.body.id]).toEqual([201, body.requestId]);
    expect(await prisma.gift.findUniqueOrThrow({ where: { id: body.requestId } })).toMatchObject({ toId: b.id, note: 'cosy' });
    expect(await prisma.gift.count({ where: { fromId: a.id } })).toBe(1);
  });

  it('a request id another sender already used is 400 invalid_body, on the read and on the unique key (P2002; T7-CARRY)', async () => {
    const { a, b, ha } = await pairedPair();
    const c = await buddyUser();
    const hc = await authHeaderFor(c.id);
    await pairUp(c.id, b.id);
    await extraFern(a.id);
    await extraFern(c.id);
    const body = gift();
    expect((await send(ha, b.id, body)).status).toBe(201);
    // Seen by the read under the lock.
    const seen = await send(hc, b.id, body);
    expect([seen.status, seen.body]).toEqual([400, { error: 'invalid_body' }]);
    // Racing past the read (the other sender's lock is not this one): the insert meets the primary key (P2002).
    const real = prisma.$transaction.bind(prisma) as (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) => Promise<unknown>;
    const tx = jest.spyOn(prisma, '$transaction').mockImplementationOnce(((fn: (tx: unknown) => Promise<unknown>, opts?: unknown) =>
      real((t) => fn(new Proxy(t as object, {
        get: (target, prop) => (prop === 'gift'
          ? { ...(target as { gift: object }).gift, findUnique: async () => null }
          : Reflect.get(target, prop)),
      })), opts)) as never);
    try {
      const raced = await send(hc, b.id, body);
      expect([raced.status, raced.body]).toEqual([400, { error: 'invalid_body' }]);
    } finally {
      tx.mockRestore();
    }
    expect(await prisma.itemGrant.count({ where: { userId: c.id, sourceKey: `gift_out:${body.requestId}` } })).toBe(0);
    expect(await prisma.gift.findUniqueOrThrow({ where: { id: body.requestId } })).toMatchObject({ fromId: a.id });
  });

  it('takes the 32 KB parser: a bigger body is 400 invalid_body (ruling 29)', async () => {
    const { b, ha } = await pairedPair();
    const res = await send(ha, b.id, { ...gift(), pad: 'x'.repeat(40 * 1024) });
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('parseGift takes exactly a uuid request id, an item id and a listed note', () => {
    const id = randomUUID();
    expect(parseGift({ requestId: id, itemId: 'plant.fern', note: 'thought' })).toEqual({ requestId: id, itemId: 'plant.fern', note: 'thought' });
    for (const bad of [null, [], {}, { requestId: 'x', itemId: 'plant.fern', note: 'cosy' }, { requestId: id, itemId: 7, note: 'cosy' },
      { requestId: id, itemId: 'plant.fern', note: 'Cosy' }, { requestId: id, itemId: 'plant.fern', note: 'cosy', extra: 1 }, { requestId: id, itemId: 'x'.repeat(65), note: 'cosy' }]) {
      expect(parseGift(bad)).toBeNull();
    }
  });
});

describe('GET /me/gifts and POST /me/gifts/:id/open', () => {
  it('lists unopened gifts with the sender\'s name and quiet for a muted sender; opening adds a NEW copy once', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift({ note: 'desk' });
    await send(ha, b.id, body);
    await prisma.buddyMute.create({ data: { muterId: b.id, mutedId: a.id } });
    const list = await (await api()).get('/me/gifts').set(hb);
    expect([list.headers['cache-control'], list.body]).toEqual(['private, no-store', { gifts: [{ id: body.requestId, itemId: 'plant.fern', note: 'desk', from: { name: 'Sam' }, quiet: true, at: expect.any(String) }] }]);
    const opened = await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
    expect([opened.status, opened.body.counts['plant.fern'], opened.headers['cache-control']]).toEqual([200, 2, 'private, no-store']);
    const twice = await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
    expect([twice.status, twice.body.counts['plant.fern']]).toEqual([200, 2]);
    // NEW in the recipient's cosmetics until seen (P2 ruling 7: an unseen positive grant is fresh).
    const cos = await (await api()).get('/me/cosmetics').set(hb);
    expect(cos.body.fresh).toContainEqual({ itemId: 'plant.fern', source: 'gift_in' });
    expect((await (await api()).get('/me/gifts').set(hb)).body).toEqual({ gifts: [] });
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(ha).send({})).body).toEqual({ error: 'gift_gone' });
    expect((await (await api()).post(`/me/gifts/${randomUUID()}/open`).set(hb).send({})).body).toEqual({ error: 'gift_gone' });
    expect((await (await api()).post('/me/gifts/nope/open').set(hb).send({})).status).toBe(404);
  });

  it('a gift from a since-deleted gifter is still delivered, named nobody (controller ruling; Review Focus 4)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    await send(ha, b.id, body);
    await deleteUserAccount(a.id, noop);
    expect((await (await api()).get('/me/gifts').set(hb)).body.gifts[0]).toMatchObject({ id: body.requestId, from: null, quiet: false });
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).status).toBe(200);
  });

  it('a recipient\'s deletion drops their gifts and never returns them (ruling 12; Review Focus 4)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    await send(ha, b.id, body);
    await deleteUserAccount(b.id, noop);
    expect([await prisma.gift.count({ where: { id: body.requestId } }), await ferns(a.id)]).toEqual([0, 1]);
  });

  it('an unopened gift goes back to its sender on a block or an unpair, never twice (ruling 12; Review Focus 5)', async () => {
    for (const end of ['unpair', 'block'] as const) {
      const { a, b, ha, hb } = await pairedPair();
      await extraFern(a.id);
      const body = gift();
      await send(ha, b.id, body);
      if (end === 'unpair') await (await api()).delete(`/me/buddies/${a.id}`).set(hb);
      else await (await api()).post(`/me/buddies/${a.id}/block`).set(hb).send({});
      expect(await prisma.gift.findUnique({ where: { id: body.requestId } })).toMatchObject({ returnedAt: expect.any(Date), openedAt: null });
      expect(await prisma.itemGrant.count({ where: { userId: a.id, sourceKey: `gift_back:${body.requestId}` } })).toBe(1);
      // Written seen (T7-CARRY): the returned copy is not NEW, so nothing tells the sender (buddies "all silent").
      expect((await prisma.itemGrant.findFirstOrThrow({ where: { userId: a.id, sourceKey: `gift_back:${body.requestId}` } })).seenAt).not.toBeNull();
      expect((await (await api()).get('/me/cosmetics').set(ha)).body.fresh).not.toContainEqual(expect.objectContaining({ source: 'gift_back' }));
      expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).body).toEqual({ error: 'gift_gone' });
      expect(await prisma.$transaction((tx) => returnGiftsTx(tx, a.id, b.id, new Date()))).toBe(0);
      expect(await ferns(a.id)).toBe(2);
    }
  });

  it('opening answers 503 try_later on a lost lock wait or a deadlock, and opens nothing (T7-CARRY)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    await send(ha, b.id, body);
    for (const failure of [
      Object.assign(new Error('Transaction API error'), { code: 'P2028' }),
      Object.assign(new Error('deadlock detected'), { code: 'P2010', meta: { code: '40P01' } }),
      Object.assign(new Error('write conflict'), { code: 'P2034' }),
    ]) {
      const tx = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(failure);
      try {
        const res = await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
        expect([res.status, res.body]).toEqual([503, { error: 'try_later' }]);
      } finally {
        tx.mockRestore();
      }
    }
    expect(await prisma.gift.findUniqueOrThrow({ where: { id: body.requestId } })).toMatchObject({ openedAt: null });
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).status).toBe(200);
  });

  it('an opened gift stays with its recipient on a later unpair', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    await send(ha, b.id, body);
    await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
    await (await api()).delete(`/me/buddies/${a.id}`).set(hb);
    expect([await ferns(a.id), await ferns(b.id)]).toEqual([1, 2]);
  });

  it('a rule piece received as a gift stays locked and unsold until earned; the sender keeps it for sale (ruling 15)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await prisma.cosmeticUnlock.create({ data: { userId: a.id, itemId: 'plant.monstera', source: 'family:SLEEP_GOAL:1' } });
    await prisma.itemGrant.create({ data: { userId: a.id, itemId: 'plant.monstera', qty: 1, sourceKey: `buy:${randomUUID()}` } });
    const body = gift({ itemId: 'plant.monstera' });
    expect((await send(ha, b.id, body)).status).toBe(201);
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).body.counts['plant.monstera']).toBe(1);
    const monstera = async (h: Record<string, string>) => ((await (await api()).get('/me/shop').set(h)).body.items as Array<{ itemId: string; locked: boolean }>).find((i) => i.itemId === 'plant.monstera');
    expect([(await monstera(hb))?.locked, (await monstera(ha))?.locked]).toEqual([true, false]);
    await fund(b.id, 500);
    const buy = await (await api()).post('/me/shop/purchases').set(hb).send({ requestId: randomUUID(), itemId: 'plant.monstera' });
    expect([buy.status, buy.body]).toEqual([400, { error: 'not_for_sale' }]);
  });
});
