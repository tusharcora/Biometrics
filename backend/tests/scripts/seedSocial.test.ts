import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { seedSocial } from '../../scripts/seedSocial';
import { pairUp } from '../buddies/helpers';

jest.mock('../../src/sync/queue', () => ({ connection: { quit: jest.fn() }, syncQueue: { close: jest.fn(), add: jest.fn() } }));
beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());
const LOCAL = { DATABASE_URL: 'postgresql://dev@localhost:5432/biometrics_dev' };
const NOW = new Date('2026-10-07T20:00:00Z');

it('refuses production and non-buddies; seeds a tired check-in and a step goal for the buddy, idempotently', async () => {
  await expect(seedSocial({ email: 'a@example.com', buddyEmail: 'b@example.com', env: { ...LOCAL, NODE_ENV: 'production' } })).rejects.toMatchObject({ name: 'SeedProductionRefused' });
  const a = await prisma.user.create({ data: { email: `seed-a-${randomUUID()}@example.com`, name: 'A' } });
  const b = await prisma.user.create({ data: { email: `seed-b-${randomUUID()}@example.com`, name: 'B' } });
  await expect(seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).rejects.toMatchObject({ name: 'SeedNotBuddies' });
  await pairUp(a.id, b.id);
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: false });
  await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL });
  expect(await prisma.checkIn.count({ where: { authorId: b.id } })).toBe(1);
  expect(await prisma.checkIn.count({ where: { authorId: a.id } })).toBe(0); // the demo account checks in by hand, to see the lock lift
  expect(await prisma.stepGoalEvent.count({ where: { authorId: b.id } })).toBe(1);
});

it("shares the buddy's newest built recap that has a line, with that line", async () => {
  const a = await prisma.user.create({ data: { email: `seed-a-${randomUUID()}@example.com`, name: 'A' } });
  const b = await prisma.user.create({ data: { email: `seed-b-${randomUUID()}@example.com`, name: 'B' } });
  await pairUp(a.id, b.id);
  const recap = (periodStart: string, line: string | null) =>
    prisma.recap.create({
      data: { userId: b.id, kind: 'WEEK', periodStart: new Date(periodStart), periodEnd: new Date(periodStart), status: 'BUILT', sleepGoalMinutes: 480, line },
    });
  const older = await recap('2026-09-21', 'An older week.');
  await recap('2026-09-28', null);
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: true });
  const shares = await prisma.recapShare.findMany({ where: { sharerId: b.id }, select: { recapId: true, line: true } });
  expect(shares).toEqual([{ recapId: older.id, line: 'An older week.' }]);
});
