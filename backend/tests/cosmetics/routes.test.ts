import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
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
      catalogueVersion: 1, owned: expect.any(Array), fresh: [], worn: { ...EMPTY_WORN }, version: 0,
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

  it('reads a stored worn piece the user does not own as nothing worn', async () => {
    const { user, headers } = await me();
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, layout: starterLayout() as unknown as Prisma.InputJsonValue, worn: worn({ head: 'out.crown' }), version: 2 } });
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect([res.body.worn.head, res.body.version, res.body.layout]).toEqual([null, 2, starterLayout()]);
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/cosmetics')).status).toBe(401);
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
