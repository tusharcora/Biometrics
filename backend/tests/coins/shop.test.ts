import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { COSMETIC_ITEMS, EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { forSale, offeredIn, parsePurchase } from '../../src/coins/shop';
import { coinsConfig } from '../../src/coins/sources';
import { SHOP_WEEKS, weekSet } from '../../src/coins/shopWeeks';
import { isoWeekKey } from '../../src/habits/job';
import { todayFor } from '../../src/social/checkins';
import { day, level } from '../cosmetics/helpers';
import { piece, withPieces } from '../room/helpers';
import { coinUser, fund, rowsOf } from './helpers';

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

const W = '2026-W44';
const buy = async (headers: Record<string, string>, itemId: string, requestId: string = randomUUID()) =>
  (await api()).post('/me/shop/purchases').set(headers).send({ requestId, itemId });
const cosmetics = async (headers: Record<string, string>) => (await (await api()).get('/me/cosmetics').set(headers)).body;

describe('the offer (spec §6.4–6.6)', () => {
  it('offers shipped, priced pieces every week, and a weekly piece only in its own week (ruling 4)', () => {
    const radio = COSMETIC_ITEMS.find((i) => i.id === 'item.radio')!;
    const items = [...COSMETIC_ITEMS, { ...radio, id: 'item.weekly', shop: { week: '2026-W43' } }];
    expect(offeredIn('2026-W43', items).map((o) => o.itemId)).toContain('item.weekly');
    expect(offeredIn(W, items).map((o) => o.itemId)).not.toContain('item.weekly');
    const ids = offeredIn(W).map((o) => o.itemId);
    expect(ids).toEqual(expect.arrayContaining(['item.radio', 'plant.fern', 'corner.floorlamp']));
    expect(ids.filter((id) => ['desk.monitor', 'lamp.welcome', 'lamp.lava'].includes(id))).toEqual([]);
  });

  it('sells a rule piece only once it is owned; shop and starter pieces always; never a desk (spec §6.5)', () => {
    expect(forSale('plant.monstera', W, {})).toBeNull();
    expect(forSale('plant.monstera', W, { 'plant.monstera': 1 })).toEqual({ itemId: 'plant.monstera', price: 140 });
    expect(forSale('item.radio', W, {})).toEqual({ itemId: 'item.radio', price: 150 });
    expect(forSale('plant.fern', W, { 'plant.fern': 1 })).toEqual({ itemId: 'plant.fern', price: 40 });
    expect(forSale('desk.monitor', W, { 'desk.monitor': 1 })).toBeNull();
  });

  it('turns the featured set every Monday over four sets of offered pieces', () => {
    expect(new Set(['2026-W43', '2026-W44', '2026-W45', '2026-W46'].map((w) => weekSet(w).id)).size).toBe(4);
    expect(weekSet('2026-W47')).toEqual(weekSet('2026-W43'));
    const offered = new Set(offeredIn(W).map((o) => o.itemId));
    for (const s of SHOP_WEEKS) for (const id of s.itemIds) expect({ id, offered: offered.has(id) }).toEqual({ id, offered: true });
  });

  it('parses exactly { requestId: uuid, itemId } (the shared UUID check, ruling T6-UUID)', () => {
    const requestId = randomUUID();
    expect(parsePurchase({ requestId, itemId: 'item.radio' })).toEqual({ requestId, itemId: 'item.radio' });
    for (const bad of [null, [], 'x', { requestId }, { requestId: 'not-a-uuid', itemId: 'item.radio' }, { requestId, itemId: '' }, { requestId, itemId: 'x'.repeat(65) }, { requestId, itemId: 7 }]) {
      expect(parsePurchase(bad)).toBeNull();
    }
  });
});

describe('GET /me/shop (spec §12)', () => {
  it('answers the user\'s local ISO week, its featured set and the offer, private no-store', async () => {
    const { user, headers } = await coinUser({ timezone: 'Pacific/Auckland' });
    const res = await (await api()).get('/me/shop').set(headers);
    const week = isoWeekKey(day((await todayFor(user.id, new Date())).today));
    expect([res.status, res.headers['cache-control'], res.body.week, res.body.set]).toEqual([200, 'private, no-store', week, { id: weekSet(week).id, itemIds: [...weekSet(week).itemIds] }]);
    expect(res.body.items).toEqual(expect.arrayContaining([{ itemId: 'item.radio', price: 150 }, { itemId: 'plant.fern', price: 40 }]));
  });
});

describe('POST /me/shop/purchases (spec §12)', () => {
  it('buys a copy: −150, already seen; +1 radio, owned, NEW in fresh until seen; the room can place it (ruling 7)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 200);
    const res = await buy(headers, 'item.radio');
    expect([res.status, res.headers['cache-control'], res.body.balance, res.body.counts['item.radio']]).toEqual([200, 'private, no-store', 50, 1]);
    const body = await cosmetics(headers);
    expect([body.counts['item.radio'], body.owned.includes('item.radio'), body.fresh]).toEqual([1, true, [{ itemId: 'item.radio', source: 'buy' }]]);
    const spend = (await rowsOf(user.id)).find((r) => r.kind === 'buy')!;
    expect([spend.amount, spend.capDay, spend.seenAt instanceof Date]).toEqual([-150, null, true]);
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'item.radio', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
    expect((await (await api()).post('/me/cosmetics/seen').set(headers).send({ itemIds: ['item.radio'] })).status).toBe(204);
    expect((await cosmetics(headers)).fresh).toEqual([]);
  });

  it('a starter\'s extra copy: after buying a fern, two ferns save', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 40);
    expect((await buy(headers, 'plant.fern')).body).toEqual({ balance: 0, counts: expect.objectContaining({ 'plant.fern': 2 }) });
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
  });

  it('a repeated or concurrent request id buys once; a replay answers the CURRENT balance (ruling PF-F9)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 200);
    const id = randomUUID();
    const [a, b] = await Promise.all([buy(headers, 'item.radio', id), buy(headers, 'item.radio', id)]);
    expect([a.status, b.status, a.body.balance, b.body.balance]).toEqual([200, 200, 50, 50]);
    await fund(user.id, 30);
    const again = await buy(headers, 'item.radio', id);
    expect([again.status, again.body.balance, again.body.counts['item.radio']]).toEqual([200, 80, 1]);
    expect(await prisma.itemGrant.count({ where: { userId: user.id } })).toBe(1);
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'buy')).toHaveLength(1);
    // One spend logged: the replays wrote nothing.
    expect(info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('coins.spent'))).toHaveLength(1);
  });

  it('409 not_enough_coins with what is still needed, and nothing is written', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 100);
    const res = await buy(headers, 'item.radio');
    expect([res.status, res.body]).toEqual([409, { error: 'not_enough_coins', needed: 50 }]);
    expect(await prisma.itemGrant.count({ where: { userId: user.id } })).toBe(0);
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'buy')).toHaveLength(0);
  });

  it('400 not_for_sale for an unknown, unpriced or unshipped piece, or a rule piece not earned yet; sold once earned', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 1000);
    for (const id of ['item.nope', 'desk.monitor', 'lamp.lava', 'plant.monstera']) {
      expect([id, (await buy(headers, id)).body]).toEqual([id, { error: 'not_for_sale' }]);
    }
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000)); // the monstera's rule
    await cosmetics(headers); // the grant catches up
    expect((await buy(headers, 'plant.monstera')).body.counts['plant.monstera']).toBe(2);
  });

  it('400 invalid_body for a bad shape, and logs the spend\'s kind only', async () => {
    const { user, headers } = await coinUser();
    for (const body of [{ itemId: 'item.radio' }, { requestId: 'x', itemId: 'item.radio' }, { requestId: randomUUID(), itemId: 'item.radio', more: 1 }]) {
      const res = await (await api()).post('/me/shop/purchases').set(headers).send(body);
      expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
    }
    await fund(user.id, 30);
    await buy(headers, 'corner.pumpkin');
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('coins.spent'));
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'coins.spent', kind: 'buy' }]);
    expect(lines.join('')).not.toContain(user.id);
  });

  it('caps its body at 32 KB with the house error (ruling 26)', async () => {
    const { headers } = await coinUser();
    const res = await (await api()).post('/me/shop/purchases').set(headers).set('Content-Type', 'application/json')
      .send(JSON.stringify({ requestId: randomUUID(), itemId: 'item.radio' }) + ' '.repeat(40 * 1024));
    expect([res.status, res.headers['cache-control'], res.body]).toEqual([400, 'private, no-store', { error: 'invalid_body' }]);
  });

  it('needs a session', async () => {
    expect((await (await api()).post('/me/shop/purchases').send({})).status).toBe(401);
    expect((await (await api()).get('/me/shop')).status).toBe(401);
  });
});
