import { readFileSync } from 'fs';
import path from 'path';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { createUser } from '../coach/helpers';

const NAME = '20261014120000_kip_coach';
const SQL = readFileSync(path.join(__dirname, `../../prisma/migrations/${NAME}/migration.sql`), 'utf8');
// Strip comments before splitting: the migration's comments contain semicolons.
const UPDATE = SQL.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).find((s) => s.startsWith('UPDATE'))!;

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

describe(NAME, () => {
  it('is data only: one UPDATE, nothing dropped or altered', () => {
    const statements = SQL.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements).toEqual([UPDATE]);
    expect(SQL).not.toMatch(/\b(DROP|ALTER)\b/i);
  });

  it('stores kip for every user and leaves the thinking text, digests and recaps alone', async () => {
    const ids = await Promise.all(['mochi', 'luna', null, 'encouraging'].map(async (id) => {
      const u = await createUser();
      await prisma.user.update({ where: { id: u.id }, data: { coachPersonaId: id, coachThinkingText: 'dialog', coachThinkingAttachment: 'gears' } });
      return u.id;
    }));
    const digest = await prisma.coachDigest.create({ data: { userId: ids[0]!, personaId: 'mochi', weekStart: new Date(Date.UTC(2026, 9, 5)), text: 'x' } });
    await prisma.$executeRawUnsafe(UPDATE);
    const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { coachPersonaId: true, coachThinkingText: true, coachThinkingAttachment: true } });
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r).toEqual({ coachPersonaId: 'kip', coachThinkingText: 'dialog', coachThinkingAttachment: 'gears' });
    expect((await prisma.coachDigest.findUniqueOrThrow({ where: { id: digest.id } })).personaId).toBe('mochi');
  });
});
