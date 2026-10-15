// The conversion script's column-present path (ruling T1-FIX), run against a scratch schema in the TEST database that
// still has Spec B's `room` and a nullable `layout`, as a database awaiting P2's drop migration does. The script's
// own client is pointed at the scratch schema; production code is unchanged. Never prints a URL.
import { PrismaClient } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { ownedFrom, readRoom } from '../../src/cosmetics/loadout';
import { layoutFromSlots } from '../../src/room/convert';
import type { RoomLayout } from '../../src/room/geometry';
import { convertRoomLayouts } from '../../scripts/convert-room-layouts';

jest.mock('../../src/db/client', () => {
  const { PrismaClient: Client } = jest.requireActual('@prisma/client');
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set('schema', `t1_convert_${process.pid}`);
  return { prisma: new Client({ datasourceUrl: url.toString() }) };
});

const SCRATCH = `t1_convert_${process.pid}`;
const admin = new PrismaClient();
const q = (table: string) => `"${SCRATCH}"."${table}"`;

async function specBRow(userId: string, room: Record<string, string | null>, version: number) {
  await admin.$executeRawUnsafe(
    `INSERT INTO ${q('CosmeticLoadout')} ("userId", "room", "worn", "layout", "version", "updatedAt") VALUES ($1, $2::jsonb, $3::jsonb, NULL, $4, now())`,
    userId, JSON.stringify(room), JSON.stringify(EMPTY_WORN), version,
  );
}
async function rowOf(userId: string) {
  const rows = await admin.$queryRawUnsafe<Array<{ layout: unknown; version: number }>>(
    `SELECT "layout", "version" FROM ${q('CosmeticLoadout')} WHERE "userId" = $1`, userId,
  );
  return rows[0]!;
}

beforeAll(async () => {
  migrateTestDb();
  const [{ main }] = await admin.$queryRaw<Array<{ main: string }>>`SELECT current_schema() AS main`;
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCRATCH}"`);
  await admin.$executeRawUnsafe(`CREATE TABLE ${q('CosmeticUnlock')} (LIKE "${main}"."CosmeticUnlock" INCLUDING ALL)`);
  await admin.$executeRawUnsafe(`CREATE TABLE ${q('CosmeticLoadout')} (LIKE "${main}"."CosmeticLoadout" INCLUDING ALL)`);
  await admin.$executeRawUnsafe(`ALTER TABLE ${q('CosmeticLoadout')} ADD COLUMN "room" JSONB NOT NULL, ALTER COLUMN "layout" DROP NOT NULL`);
});
afterAll(async () => {
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCRATCH}" CASCADE`);
  await admin.$disconnect();
  await prisma.$disconnect();
  await connection.quit();
});

it('converts Spec B rows in batches, skips a row a slot save changed mid-way, never bumps a version, and converts 0 once done', async () => {
  const roomA = { ...STARTER_ROOM, plant: 'plant.cactus', rug: 'rug.red', corner: 'corner.bag' }; // owns the rug, not the bag
  const roomC = { ...STARTER_ROOM, art: null };
  await specBRow('t1-a', roomA, 2);
  await specBRow('t1-b', { ...STARTER_ROOM }, 5);
  await specBRow('t1-c', roomC, 0);
  await admin.$executeRawUnsafe(
    `INSERT INTO ${q('CosmeticUnlock')} ("userId", "itemId", "source") VALUES ('t1-a', 'rug.red', 'backfill')`,
  );
  // An old server's slot save lands on t1-b between the script's read and its conditional write: a new room and a
  // new version, the layout still null. Only the version match keeps the script from writing the stale room.
  const roomB = { ...STARTER_ROOM, desk: 'desk.notebook' };
  const real = prisma.cosmeticUnlock.findMany.bind(prisma.cosmeticUnlock);
  const spy = jest.spyOn(prisma.cosmeticUnlock, 'findMany').mockImplementation(((args: Parameters<typeof real>[0]) => {
    if (args?.where?.userId !== 't1-b') return real(args);
    return admin.$executeRawUnsafe(
      `UPDATE ${q('CosmeticLoadout')} SET "room" = $1::jsonb, "version" = "version" + 1 WHERE "userId" = 't1-b'`, JSON.stringify(roomB),
    ).then(() => real(args));
  }) as unknown as typeof real);
  try {
    expect(await convertRoomLayouts(1)).toEqual({ converted: 2, skipped: 1 });
    expect(spy).toHaveBeenCalledTimes(3); // one row per batch, three batches
  } finally {
    spy.mockRestore();
  }

  const a = await rowOf('t1-a');
  expect(a).toEqual({ layout: layoutFromSlots(readRoom(roomA, ownedFrom([{ itemId: 'rug.red' }]))), version: 2 });
  const layoutA = a.layout as RoomLayout;
  expect(layoutA.pieces.find((p) => p.id === 'rug')!.item).toBe('rug.red');
  expect(layoutA.pieces.find((p) => p.id === 'plant')!.item).toBe('plant.cactus');
  expect(layoutA.pieces.some((p) => p.item === 'corner.bag')).toBe(false);
  expect(await rowOf('t1-b')).toEqual({ layout: null, version: 6 }); // skipped: the script wrote nothing
  expect(await rowOf('t1-c')).toEqual({ layout: layoutFromSlots(readRoom(roomC, ownedFrom([]))), version: 0 });

  // The next run converts the skipped row from the room the save wrote; the one after has nothing left to do.
  expect(await convertRoomLayouts(1)).toEqual({ converted: 1, skipped: 0 });
  expect(await rowOf('t1-b')).toEqual({ layout: layoutFromSlots(readRoom(roomB, ownedFrom([]))), version: 6 });
  expect(await convertRoomLayouts(1)).toEqual({ converted: 0, skipped: 0 });
  expect([(await rowOf('t1-a')).version, (await rowOf('t1-b')).version, (await rowOf('t1-c')).version]).toEqual([2, 6, 0]);
});
