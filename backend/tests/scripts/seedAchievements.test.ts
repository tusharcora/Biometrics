import { prisma } from '../../src/db/client';
import { SAMPLE_LEVELS, assertDevDatabase, seedAchievements } from '../../scripts/seedAchievements';
import { migrateTestDb } from '../setupTestDb';
import { createUser } from '../scoring/dbHelpers';

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

const LOCAL = { DATABASE_URL: 'postgresql://dev@localhost:5432/biometrics_dev' };
const NOW = new Date('2026-10-10T12:00:00Z');
const key = (d: Date | null | undefined) => d?.toISOString().slice(0, 10);

it('refuses production and any database that is not local', () => {
  expect(() => assertDevDatabase({ ...LOCAL, NODE_ENV: 'production' })).toThrow('production');
  expect(() => assertDevDatabase({ DATABASE_URL: 'postgresql://dev@db.example.com:5432/biometrics' })).toThrow('not a local database');
  expect(() => assertDevDatabase({})).toThrow('not a local database');
  expect(() => assertDevDatabase(LOCAL)).not.toThrow();
});

it('awards the sample levels once, two still to celebrate, and sets a start date when none is set', async () => {
  const user = await createUser();
  const first = await seedAchievements({ email: user.email, now: NOW, env: LOCAL });
  const again = await seedAchievements({ email: user.email, now: NOW, env: LOCAL });
  expect(first).toEqual({ userId: user.id, created: SAMPLE_LEVELS.length });
  expect(again.created).toBe(0);
  expect(await prisma.achievement.count({ where: { userId: user.id, celebratedAt: null } })).toBe(2);
  const row = await prisma.achievement.findUniqueOrThrow({ where: { userId_family_level: { userId: user.id, family: 'SLEEP_GOAL', level: 2 } } });
  expect([row.value, key(row.earnedOn), key(row.weekStart), key(row.monthStart)]).toEqual([7, '2026-10-02', '2026-09-28', '2026-10-01']);
  expect(key((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).achievementsSince)).toBe('2026-09-10');
});

it('refuses an unknown email', async () => {
  await expect(seedAchievements({ email: 'nobody-here@example.com', now: NOW, env: LOCAL })).rejects.toThrow('No user');
});
