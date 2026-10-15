import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_IDS } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
import type { RoomLayout } from '../../src/room/geometry';
import { level } from '../cosmetics/helpers';
import { piece } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

async function me() {
  const user = await buddyUser();
  return { user, headers: await authHeaderFor(user.id) };
}
const get = async (headers: Record<string, string>) => (await (await api()).get('/me/cosmetics').set(headers)).body;
/** A stored loadout row with this layout. */
const stored = (userId: string, layout: RoomLayout, version = 4) =>
  prisma.cosmeticLoadout.create({ data: { userId, worn: { ...EMPTY_WORN }, layout: layout as unknown as Prisma.InputJsonValue, version } });

describe('GET /me/cosmetics (free-build)', () => {
  it('a new user: the starter layout, tier 1, a cap of 40, a count for each of the 19 starters, not welcomed, no slot room', async () => {
    const { headers } = await me();
    const body = await get(headers);
    expect([body.layout, body.tier, body.cap, body.version, body.welcomed]).toEqual([starterLayout(), 1, 40, 0, false]);
    expect(Object.keys(body.counts).sort()).toEqual([...STARTER_IDS].sort());
    expect(Object.values(body.counts).every((n) => n === 1)).toBe(true);
    expect(body).not.toHaveProperty('room'); // spec §2.4: dropped in P2
  });

  it('counts an unlocked item once per unlock row (grants defaults to 1)', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000));
    expect((await get(headers)).counts['rug.red']).toBe(1);
  });

  it('drops placements over the owned count at read, highest id first, children too, and keeps the stored row (spec §2.2)', async () => {
    const { user, headers } = await me();
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('st', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 1 })] };
    await stored(user.id, layout);
    expect((await get(headers)).layout).toEqual(starterLayout());
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect(row!.layout).toEqual(layout);
  });

  it('drops only the true excess: a child that leaves with its dropped parent frees its copy for another (ruling T4-CARRY)', async () => {
    const { user, headers } = await me();
    const kept = piece('st', 'item.sticky', { layer: 'onTop', parent: 'plank', spot: 1 });
    await stored(user.id, { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('a1', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 0 }), kept] });
    expect((await get(headers)).layout).toEqual({ ...starterLayout(), pieces: [...starterLayout().pieces, kept] });
  });

  it('drops the newest copies first: p10 goes before p9 (ruling 31, P1 Task 4 minor)', async () => {
    const { user, headers } = await me();
    await stored(user.id, { ...starterLayout(), pieces: [...starterLayout().pieces, piece('p9', 'plant.cactus', { x: 6, y: 6 }), piece('p10', 'plant.cactus', { x: 5, y: 6 })] });
    const ids = (await get(headers)).layout.pieces.map((p: { id: string }) => p.id);
    expect([ids.includes('p9'), ids.includes('p10')]).toEqual([true, false]);
  });

  it('ranks a p<n> id by n and any other id as 0, so an app copy drops before an older id that sorts after it (ruling PF-F1)', async () => {
    const { user, headers } = await me();
    await stored(user.id, { ...starterLayout(), pieces: [...starterLayout().pieces, piece('zz', 'plant.cactus', { x: 6, y: 6 }), piece('p2', 'plant.cactus', { x: 5, y: 6 })] });
    const ids = (await get(headers)).layout.pieces.map((p: { id: string }) => p.id);
    expect([ids.includes('zz'), ids.includes('p2')]).toEqual([true, false]);
  });

  it('drops unshipped placements and reads an unowned style as the starter style (ruling 23)', async () => {
    const { user, headers } = await me();
    await stored(user.id, { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' }, pieces: [...starterLayout().pieces, piece('x1', 'desk.dual', { x: 2, y: 4 })] }, 1);
    expect((await get(headers)).layout).toEqual(starterLayout());
  });

  it('says welcomed once RoomFirstWeek.welcomedAt is set, and that row never creates a loadout', async () => {
    const { user, headers } = await me();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, welcomedAt: new Date() } });
    const body = await get(headers);
    expect([body.welcomed, body.version]).toEqual([true, 0]);
    expect(await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } })).toBeNull();
  });
});
