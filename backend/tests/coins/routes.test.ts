import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { applyCoinEvents } from '../../src/coins/ledger';
import { coinsConfig } from '../../src/coins/sources';
import { weekRecaps } from '../cosmetics/helpers';
import { coinUser, earn } from './helpers';

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

const get = async (headers: Record<string, string>, query = '') => (await api()).get(`/me/coins${query}`).set(headers);
const seen = async (headers: Record<string, string>, body: unknown) => (await api()).post('/me/coins/seen').set(headers).send(body as object);

describe('GET /me/coins (spec §12)', () => {
  it('a new user: no coins, nothing earned today of 60, no events, private no-store', async () => {
    const { headers } = await coinUser();
    const res = await get(headers);
    expect([res.status, res.headers['cache-control'], res.body]).toEqual([200, 'private, no-store', { balance: 0, today: { earned: 0, cap: 60 }, events: [], next: null }]);
  });

  it('catches up first: a weekly recap read today lands as +10, unseen, in today\'s local total (Review Focus 2)', async () => {
    const { user, headers } = await coinUser({ timezone: 'Pacific/Auckland' });
    await weekRecaps(user.id, 1, new Date());
    expect((await get(headers)).body).toEqual({ balance: 10, today: { earned: 10, cap: 60 }, events: [{ kind: 'recap', amount: 10, at: expect.any(String), seen: false }], next: null });
  });

  it('pages newest first, 30 at a time, with an opaque cursor; a bad cursor is 400 invalid_body', async () => {
    const { user, headers } = await coinUser();
    for (let k = 0; k < 31; k++) await applyCoinEvents(user.id, [earn('firstweek', `test:${k}`, 1)], new Date());
    const first = (await get(headers)).body;
    expect([first.events.length, typeof first.next]).toEqual([30, 'string']);
    const second = (await get(headers, `?cursor=${encodeURIComponent(first.next)}`)).body;
    expect([second.events.length, second.next, second.balance]).toEqual([1, null, 31]);
    const ats = [...first.events, ...second.events].map((e: { at: string }) => e.at);
    expect([...ats].sort().reverse()).toEqual(ats);
    expect((await get(headers, '?cursor=%21%21')).body).toEqual({ error: 'invalid_body' });
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/coins')).status).toBe(401);
  });
});

describe('POST /me/coins/seen (spec §12)', () => {
  it('marks every event up to `through` seen, and refuses a bad body', async () => {
    const { user, headers } = await coinUser();
    await weekRecaps(user.id, 1, new Date());
    const at = (await get(headers)).body.events[0].at;
    expect((await seen(headers, { through: at })).status).toBe(204);
    expect((await get(headers)).body.events[0].seen).toBe(true);
    for (const bad of [{}, { through: 'yesterday' }, { through: at, more: 1 }, []]) {
      expect((await seen(headers, bad)).body).toEqual({ error: 'invalid_body' });
    }
  });

  it('caps its body at 32 KB with the house error (ruling 26)', async () => {
    const { headers } = await coinUser();
    const res = await (await api()).post('/me/coins/seen').set(headers).set('Content-Type', 'application/json')
      .send(JSON.stringify({ through: new Date().toISOString() }) + ' '.repeat(40 * 1024));
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });
});
