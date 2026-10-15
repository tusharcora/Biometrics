/// <reference types="node" />
// Converts every Spec B slot room to an iso layout once (spec 2026-10-15 §2.4), with a conditional write (only while
// the row is unconverted at the version read, never bumping it). P2's deploy runs it BEFORE `prisma migrate deploy`,
// whose first statement refuses to drop `room` while a layout is still null. It reads and writes with raw SQL, so it
// runs with a client generated from a schema that no longer has `room`; once the column is gone it converts nothing.
// Logs counts only, never a user id or a layout.
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts
import { prisma } from '../src/db/client';
import { ownedFrom, readRoom } from '../src/cosmetics/loadout';
import { layoutFromSlots } from '../src/room/convert';
import type { RoomLayout } from '../src/room/geometry';

/** The layout a stored slot room converts to: from Spec B's sanitised room, never the raw JSON. */
export function layoutForRow(room: unknown, unlocks: ReadonlyArray<{ itemId: string }>): RoomLayout {
  return layoutFromSlots(readRoom(room, ownedFrom(unlocks)));
}

async function hasRoomColumn(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'CosmeticLoadout' AND column_name = 'room'
    ) AS present`;
  return rows[0]?.present === true;
}

export async function convertRoomLayouts(batch = 200): Promise<{ converted: number; skipped: number }> {
  let converted = 0;
  let skipped = 0;
  if (!(await hasRoomColumn())) return { converted, skipped };
  let after = '';
  for (;;) {
    const rows = await prisma.$queryRaw<Array<{ userId: string; room: unknown; version: number }>>`
      SELECT "userId", "room", "version" FROM "CosmeticLoadout"
      WHERE "layout" IS NULL AND "userId" > ${after} ORDER BY "userId" LIMIT ${batch}`;
    if (!rows.length) break;
    for (const row of rows) {
      const unlocks = await prisma.cosmeticUnlock.findMany({ where: { userId: row.userId }, select: { itemId: true } });
      const layout = JSON.stringify(layoutForRow(row.room, unlocks));
      const n = await prisma.$executeRaw`
        UPDATE "CosmeticLoadout" SET "layout" = ${layout}::jsonb
        WHERE "userId" = ${row.userId} AND "layout" IS NULL AND "version" = ${row.version}`;
      if (n === 1) converted++;
      else skipped++;
    }
    after = rows[rows.length - 1]!.userId;
  }
  return { converted, skipped };
}

if (require.main === module) {
  convertRoomLayouts()
    .then(async (r) => {
      console.log(JSON.stringify({ event: 'room.converted', ...r }));
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(JSON.stringify({ event: 'room.convert_failed', error: err instanceof Error ? err.name : 'Error' }));
      await prisma.$disconnect();
      process.exit(1);
    });
}
