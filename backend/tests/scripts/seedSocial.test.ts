import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { SEED_CAMP_NOTE, seedSocial } from '../../scripts/seedSocial';
import { getCamp } from '../../src/social/camp';
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
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: false, campNote: true, goodnight: true });
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
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: true, campNote: true, goodnight: true });
  const shares = await prisma.recapShare.findMany({ where: { sharerId: b.id }, select: { recapId: true, line: true } });
  expect(shares).toEqual([{ recapId: older.id, line: 'An older week.' }]);
});

it('passes over recaps whose line is blank, instead of failing after the check-in is written', async () => {
  const a = await prisma.user.create({ data: { email: `seed-a-${randomUUID()}@example.com`, name: 'A' } });
  const b = await prisma.user.create({ data: { email: `seed-b-${randomUUID()}@example.com`, name: 'B' } });
  await pairUp(a.id, b.id);
  const recap = (periodStart: string, line: string) =>
    prisma.recap.create({
      data: { userId: b.id, kind: 'WEEK', periodStart: new Date(periodStart), periodEnd: new Date(periodStart), status: 'BUILT', sleepGoalMinutes: 480, line },
    });
  const older = await recap('2026-09-14', 'A real line.');
  await recap('2026-09-21', '');
  await recap('2026-09-28', '   ');
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: true, campNote: true, goodnight: true });
  const shares = await prisma.recapShare.findMany({ where: { sharerId: b.id }, select: { recapId: true, line: true } });
  expect(shares).toEqual([{ recapId: older.id, line: 'A real line.' }]);
});

it('shares nothing when every line is blank, and still seeds the rest', async () => {
  const a = await prisma.user.create({ data: { email: `seed-a-${randomUUID()}@example.com`, name: 'A' } });
  const b = await prisma.user.create({ data: { email: `seed-b-${randomUUID()}@example.com`, name: 'B' } });
  await pairUp(a.id, b.id);
  await prisma.recap.create({
    data: { userId: b.id, kind: 'WEEK', periodStart: new Date('2026-09-28'), periodEnd: new Date('2026-09-28'), status: 'BUILT', sleepGoalMinutes: 480, line: ' \n ' },
  });
  expect(await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL })).toEqual({ buddyCheckedIn: true, stepGoal: true, recapShared: false, campNote: true, goodnight: true });
  expect(await prisma.recapShare.count({ where: { sharerId: b.id } })).toBe(0);
});

it("seeds the buddy's camp: a note over an asleep coach, idempotently", async () => {
  const a = await prisma.user.create({ data: { email: `seed-a-${randomUUID()}@example.com`, name: 'A' } });
  const b = await prisma.user.create({ data: { email: `seed-b-${randomUUID()}@example.com`, name: 'B' } });
  await pairUp(a.id, b.id);
  await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL });
  await seedSocial({ email: a.email, buddyEmail: b.email, now: NOW, env: LOCAL });
  expect(await prisma.campNote.findMany({ where: { authorId: b.id }, select: { text: true } })).toEqual([{ text: SEED_CAMP_NOTE }]);
  expect(await prisma.goodnight.count({ where: { authorId: b.id } })).toBe(1);
  // The demo account sees it: NOW is 20:00 in the buddy's zone (UTC), so the camp is at night and the buddy asleep.
  const camp = await getCamp(a.id, NOW);
  expect(camp.night).toBe(true);
  expect(camp.members.find((m) => m.person.id === b.id)).toMatchObject({ asleep: true, note: SEED_CAMP_NOTE });
});
