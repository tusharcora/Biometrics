/// <reference types="node" />
// Converts every Spec B slot room to an iso layout once (spec 2026-10-15 §2.4), with the same conditional write as
// the lazy GET, so the two can run in either order and a second run converts nothing. P2's deploy runs it before
// `prisma migrate deploy`. Logs counts only, never a user id or a layout.
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/client';
import { convertLoadout } from '../src/cosmetics/loadout';

export async function convertRoomLayouts(batch = 200): Promise<{ converted: number; skipped: number }> {
  let converted = 0;
  let skipped = 0;
  let after = '';
  for (;;) {
    const rows = await prisma.cosmeticLoadout.findMany({
      where: { layout: { equals: Prisma.DbNull }, userId: { gt: after } },
      orderBy: { userId: 'asc' },
      take: batch,
      select: { userId: true, room: true, version: true },
    });
    if (!rows.length) break;
    for (const row of rows) (await convertLoadout(row)) ? converted++ : skipped++;
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
