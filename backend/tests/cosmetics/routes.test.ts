import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { slotsFromLayout, starterLayout } from '../../src/room/convert';
import { level } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const SOON = new Date(Date.now() - 1000);
const room = (over: Record<string, string | null> = {}) => ({ ...STARTER_ROOM, ...over });
const worn = (over: Record<string, string | null> = {}) => ({ ...EMPTY_WORN, ...over });
async function me() {
  const user = await buddyUser();
  return { user, headers: await authHeaderFor(user.id) };
}

describe('GET /me/cosmetics', () => {
  it('a new user owns the 17 starters, has the starter room, wears nothing, and reads private, no-store', async () => {
    const { headers } = await me();
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toEqual({
      catalogueVersion: 1, owned: expect.any(Array), fresh: [], room: slotsFromLayout(starterLayout()), worn: { ...EMPTY_WORN }, version: 0,
      counters: { recapsRead: 0, buddyCheers: 0 }, layout: starterLayout(), tier: 1, cap: 40, counts: expect.any(Object), welcomed: false,
    });
    expect(res.body.owned).toHaveLength(19);
  });

  it('catches up on grants and lists unseen rows as fresh with their source', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, SOON);
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect(res.body.owned).toEqual(expect.arrayContaining(['rug.red', 'shelf.trophyB']));
    expect(res.body.fresh.map((f: { itemId: string }) => f.itemId).sort()).toEqual(['art.mountain', 'floor.carpet', 'item.bottle', 'plant.monstera', 'rug.red', 'shelf.trophyB']);
    expect(res.body.fresh[0]).toEqual({ itemId: expect.any(String), source: expect.any(String) });
  });

  it('reads a stored slot naming an item the user no longer owns as the starter piece', async () => {
    const { user, headers } = await me();
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: room({ rug: 'rug.red', corner: 'corner.bag' }), worn: worn({ head: 'out.crown' }), version: 2 } });
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect([res.body.room.rug, res.body.room.corner, res.body.worn.head, res.body.version]).toEqual(['rug.slate', null, null, 2]);
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/cosmetics')).status).toBe(401);
  });
});

describe('PUT /me/cosmetics', () => {
  it('saves owned pieces and answers with the GET body', async () => {
    const { headers } = await me();
    const body = { room: room({ wallpaper: 'wall.dots', desk: 'desk.notebook', art: null }), worn: worn({ head: 'out.beanie', ears: 'out.earbuds' }), version: 0 };
    const res = await (await api()).put('/me/cosmetics').set(headers).send(body);
    expect(res.status).toBe(200);
    expect([res.body.room, res.body.worn, res.body.version]).toEqual([body.room, body.worn, 1]);
    expect((await (await api()).get('/me/cosmetics').set(headers)).body.room.wallpaper).toBe('wall.dots');
  });

  it.each([
    ['a missing room key', () => { const r: Record<string, unknown> = room(); delete r.pet; return { room: r, worn: worn(), version: 0 }; }],
    ['an extra room key', () => ({ room: { ...room(), sofa: null }, worn: worn(), version: 0 })],
    ['a missing worn key', () => ({ room: room(), worn: { head: null, face: null, neck: null }, version: 0 })],
    ['a non-string id', () => ({ room: room({ rug: 3 as unknown as string }), worn: worn(), version: 0 })],
    ['a non-integer version', () => ({ room: room(), worn: worn(), version: 1.5 })],
    ['no body', () => undefined],
  ])('400 invalid_body for %s', async (_label, make) => {
    const { headers } = await me();
    const res = await (await api()).put('/me/cosmetics').set(headers).send(make() as object);
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('400 unknown_item for an id not in the catalogue or above the shipped release', async () => {
    const { headers } = await me();
    for (const id of ['wall.nope', 'wall.shoji']) {
      const res = await (await api()).put('/me/cosmetics').set(headers).send({ room: room({ wallpaper: id }), worn: worn(), version: 0 });
      expect([res.status, res.body]).toEqual([400, { error: 'unknown_item' }]);
    }
  });

  it('400 wrong_slot and 400 required_slot', async () => {
    const { headers } = await me();
    const wrong = await (await api()).put('/me/cosmetics').set(headers).send({ room: room({ rug: 'plant.fern' }), worn: worn(), version: 0 });
    expect([wrong.status, wrong.body]).toEqual([400, { error: 'wrong_slot' }]);
    const required = await (await api()).put('/me/cosmetics').set(headers).send({ room: room({ floor: null }), worn: worn(), version: 0 });
    expect([required.status, required.body]).toEqual([400, { error: 'required_slot' }]);
  });

  it('403 not_owned with the ids: the server never trusts the app about ownership', async () => {
    const { headers } = await me();
    const res = await (await api()).put('/me/cosmetics').set(headers).send({ room: room({ rug: 'rug.red', pet: 'pet.bed' }), worn: worn({ head: 'out.cap' }), version: 0 });
    expect([res.status, res.body]).toEqual([403, { error: 'not_owned', itemIds: ['out.cap', 'pet.bed', 'rug.red'] }]);
  });

  it('409 stale for an old version, and two concurrent first saves give one 200 and one 409', async () => {
    const { headers } = await me();
    const body = { room: room({ wallpaper: 'wall.dots' }), worn: worn(), version: 0 };
    const [a, b] = await Promise.all([
      (await api()).put('/me/cosmetics').set(headers).send(body),
      (await api()).put('/me/cosmetics').set(headers).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const stale = await (await api()).put('/me/cosmetics').set(headers).send(body);
    expect([stale.status, stale.body]).toEqual([409, { error: 'stale' }]);
    const next = await (await api()).put('/me/cosmetics').set(headers).send({ ...body, version: 1 });
    expect([next.status, next.body.version]).toEqual([200, 2]);
  });

  it('needs a session', async () => {
    expect((await (await api()).put('/me/cosmetics').send({})).status).toBe(401);
  });
});

describe('POST /me/cosmetics/seen', () => {
  it('marks only the given owned rows seen; unknown and unowned ids are ignored', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, SOON);
    await (await api()).get('/me/cosmetics').set(headers);
    const res = await (await api()).post('/me/cosmetics/seen').set(headers).send({ itemIds: ['rug.red', 'wall.nope', 'out.crown'] });
    expect(res.status).toBe(204);
    const fresh = (await (await api()).get('/me/cosmetics').set(headers)).body.fresh.map((f: { itemId: string }) => f.itemId);
    expect(fresh).not.toContain('rug.red');
    expect(fresh).toContain('art.mountain');
  });

  it('400 invalid_body when itemIds is not a list of strings', async () => {
    const { headers } = await me();
    for (const body of [{}, { itemIds: 'rug.red' }, { itemIds: [1] }]) {
      expect((await (await api()).post('/me/cosmetics/seen').set(headers).send(body)).status).toBe(400);
    }
  });
});
