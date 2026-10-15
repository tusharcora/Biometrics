import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { convertRoomLayouts } from '../../scripts/convert-room-layouts';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('converts every Spec B row once, gives the same layout the lazy GET would, and is idempotent (spec §2.4)', async () => {
  const quiet = jest.spyOn(console, 'info').mockImplementation(() => {});
  const a = await buddyUser();
  const b = await buddyUser();
  for (const u of [a, b]) {
    await prisma.cosmeticLoadout.create({ data: { userId: u.id, room: { ...STARTER_ROOM, plant: 'plant.cactus' }, worn: { ...EMPTY_WORN }, version: 2 } });
  }
  const first = await convertRoomLayouts(1);
  expect(first.converted).toBeGreaterThanOrEqual(2);
  expect((await convertRoomLayouts()).converted).toBe(0);
  const gotA = (await (await api()).get('/me/cosmetics').set(await authHeaderFor(a.id))).body;
  const rowA = await prisma.cosmeticLoadout.findUnique({ where: { userId: a.id } });
  expect(gotA.layout).toEqual(rowA!.layout);
  expect(gotA.layout.pieces.find((p: { id: string }) => p.id === 'plant').item).toBe('plant.cactus');
  expect(rowA!.version).toBe(2);
  quiet.mockRestore();
});
