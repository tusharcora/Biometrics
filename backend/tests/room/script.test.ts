import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { ownedFrom, readRoom } from '../../src/cosmetics/loadout';
import { layoutFromSlots } from '../../src/room/convert';
import { convertRoomLayouts, layoutForRow } from '../../scripts/convert-room-layouts';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('the drop migration dropped `room` and made `layout` required (spec §2.4)', async () => {
  const cols = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'CosmeticLoadout'`;
  expect(cols.find((c) => c.column_name === 'room')).toBeUndefined();
  expect(cols.find((c) => c.column_name === 'layout')!.is_nullable).toBe('NO');
});

it('the migration raises before it drops anything while a row still needs converting', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261017120000_drop_slot_room/migration.sql'), 'utf8');
  expect(sql.indexOf('RAISE EXCEPTION')).toBeGreaterThan(-1);
  expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(sql.indexOf('DROP COLUMN'));
  expect(sql).toMatch(/"layout" IS NULL/);
});

it('converts nothing, and never fails, once the column is gone', async () => {
  expect(await convertRoomLayouts()).toEqual({ converted: 0, skipped: 0 });
});

it('converts a Spec B room from its sanitised slots, exactly as the lazy GET did in P1', () => {
  const room = { ...STARTER_ROOM, plant: 'plant.cactus', rug: 'rug.red' }; // the rug is not owned
  const layout = layoutForRow(room, []);
  expect(layout).toEqual(layoutFromSlots(readRoom(room, ownedFrom([]))));
  expect(layout.pieces.find((p) => p.id === 'rug')!.item).toBe('rug.slate');
  expect(layout.pieces.find((p) => p.id === 'plant')!.item).toBe('plant.cactus');
});
