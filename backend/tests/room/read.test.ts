import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_IDS, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { convertLoadout } from '../../src/cosmetics/loadout';
import { layoutFromSlots, slotsFromLayout, starterLayout } from '../../src/room/convert';
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
/** A Spec B row: a slot room, no layout yet. */
const specBRow = (userId: string, room: Record<string, string | null>, version = 3) =>
  prisma.cosmeticLoadout.create({ data: { userId, room: { ...STARTER_ROOM, ...room }, worn: { ...EMPTY_WORN }, version } });

describe('GET /me/cosmetics (free-build)', () => {
  it('a new user: the starter layout, tier 1, a cap of 40, a count for each of the 19 starters, not welcomed', async () => {
    const { headers } = await me();
    const body = await get(headers);
    expect([body.layout, body.tier, body.cap, body.version, body.welcomed]).toEqual([starterLayout(), 1, 40, 0, false]);
    expect(Object.keys(body.counts).sort()).toEqual([...STARTER_IDS].sort());
    expect(Object.values(body.counts).every((n) => n === 1)).toBe(true);
    expect(body.room).toEqual(slotsFromLayout(starterLayout()));
  });

  it('counts an unlocked item once per unlock row (grants defaults to 1)', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000));
    expect((await get(headers)).counts['rug.red']).toBe(1);
  });

  it('converts a Spec B room once, from the sanitised room, without bumping the version (spec §2.4)', async () => {
    const { user, headers } = await me();
    await specBRow(user.id, { rug: 'rug.red', corner: 'corner.bag' }); // neither is owned
    const first = await get(headers);
    expect(first.layout).toEqual(layoutFromSlots({ ...STARTER_ROOM, rug: 'rug.slate', corner: null }));
    expect(first.version).toBe(3);
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect([row!.layout, row!.version]).toEqual([first.layout, 3]);
    expect((await get(headers)).layout).toEqual(first.layout);
  });

  it('two GETs racing the conversion both answer the same layout; the conditional write lands once', async () => {
    const { user, headers } = await me();
    await specBRow(user.id, { desk: 'desk.notebook' });
    const [a, b] = await Promise.all([get(headers), get(headers)]);
    expect(a.layout).toEqual(b.layout);
    expect(a.layout.pieces.find((p: { id: string }) => p.id === 'desk').item).toBe('desk.notebook');
  });

  it('the conditional write never overwrites: a stale version writes nothing', async () => {
    const { user } = await me();
    await specBRow(user.id, {}, 2);
    expect(await convertLoadout({ userId: user.id, room: STARTER_ROOM, version: 5 })).toBe(false);
    const row = await prisma.cosmeticLoadout.findFirst({ where: { userId: user.id, layout: { equals: Prisma.DbNull } } });
    expect(row).not.toBeNull();
  });

  it('drops placements over the owned count at read, highest id first, children too, and keeps the stored row (spec §2.2)', async () => {
    const { user, headers } = await me();
    const stored = { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('st', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 1 })] };
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: STARTER_ROOM, worn: EMPTY_WORN, layout: stored as unknown as Prisma.InputJsonValue, version: 4 } });
    expect((await get(headers)).layout).toEqual(starterLayout());
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect(row!.layout).toEqual(stored);
  });

  it('drops only the true excess: a child that leaves with its dropped parent frees its copy for another (ruling T4-CARRY)', async () => {
    const { user, headers } = await me();
    // One plank and one sticky owned. The extra plank 'pz' goes, taking its sticky 'a1'; the sticky 'st' on the kept
    // plank is then within the count, so it stays.
    const kept = piece('st', 'item.sticky', { layer: 'onTop', parent: 'plank', spot: 1 });
    const stored = { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('a1', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 0 }), kept] };
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: STARTER_ROOM, worn: EMPTY_WORN, layout: stored as unknown as Prisma.InputJsonValue, version: 4 } });
    expect((await get(headers)).layout).toEqual({ ...starterLayout(), pieces: [...starterLayout().pieces, kept] });
  });

  it('two conversions racing on one row: exactly one writes', async () => {
    const { user } = await me();
    const row = await specBRow(user.id, { plant: 'plant.cactus' });
    const won = await Promise.all([convertLoadout(row), convertLoadout(row)]);
    expect(won.sort()).toEqual([false, true]);
  });

  it('a slot save landing between the read and the conversion is converted on a second pass, not read as the starter', async () => {
    const { user, headers } = await me();
    await specBRow(user.id, {}, 3);
    // An old server's slot save lands just before this GET's conditional write: a new room, layout still null.
    const real = prisma.cosmeticLoadout.updateMany.bind(prisma.cosmeticLoadout);
    let raced = false;
    const spy = jest.spyOn(prisma.cosmeticLoadout, 'updateMany').mockImplementation(((args: Parameters<typeof real>[0]) => {
      if (!raced) {
        raced = true;
        return real({ where: { userId: user.id }, data: { room: { ...STARTER_ROOM, desk: 'desk.notebook' }, version: { increment: 1 } } }).then(() => real(args));
      }
      return real(args);
    }) as unknown as typeof real);
    try {
      const body = await get(headers);
      expect(body.layout.pieces.find((p: { id: string }) => p.id === 'desk').item).toBe('desk.notebook');
      expect(body.version).toBe(4);
      expect((await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } }))!.layout).toEqual(body.layout);
    } finally {
      spy.mockRestore();
    }
  });

  it('drops unshipped placements and reads an unowned style as the starter style (ruling 23)', async () => {
    const { user, headers } = await me();
    const stored = { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' }, pieces: [...starterLayout().pieces, piece('x1', 'desk.dual', { x: 2, y: 4 })] };
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: STARTER_ROOM, worn: EMPTY_WORN, layout: stored as unknown as Prisma.InputJsonValue, version: 1 } });
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
