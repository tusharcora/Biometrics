// P4's tables and account deletion (spec 2026-10-15 §10, §12; the controller ruling on gifts and deleted accounts).
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { purgeSocialJsonMentions } from '../../src/buddies/models';
import { deleteUserAccount } from '../../src/users/deletion';
import { buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const noop = { deleteSubscription: async () => {}, revokeToken: async () => {}, log: () => {} };
const day = new Date('2026-10-26T00:00:00.000Z');

it('visits are off by default for every account (spec §10.1)', async () => {
  const u = await buddyUser();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).shareRoom).toBe(false);
});

it('one room cheer per visitor, room and local day (spec §10.2)', async () => {
  const [a, b] = [await buddyUser(), await buddyUser()];
  await prisma.roomCheer.create({ data: { fromId: a.id, toId: b.id, localDate: day } });
  await expect(prisma.roomCheer.create({ data: { fromId: a.id, toId: b.id, localDate: day } })).rejects.toMatchObject({ code: 'P2002' });
  await prisma.roomCheer.create({ data: { fromId: b.id, toId: a.id, localDate: day } });
});

it('a deleted gifter\'s gift stays, with no sender; a deleted recipient\'s gifts go (controller ruling, §10.3; Review Focus 4)', async () => {
  const [giver, keeper, leaver] = [await buddyUser(), await buddyUser(), await buddyUser()];
  await pairUp(giver.id, keeper.id);
  await pairUp(keeper.id, leaver.id);
  const kept = await prisma.gift.create({ data: { id: randomUUID(), fromId: giver.id, toId: keeper.id, itemId: 'plant.fern', note: 'cosy' } });
  const dropped = await prisma.gift.create({ data: { id: randomUUID(), fromId: keeper.id, toId: leaver.id, itemId: 'plant.fern', note: 'desk' } });
  await deleteUserAccount(giver.id, noop);
  await deleteUserAccount(leaver.id, noop);
  expect(await prisma.gift.findUnique({ where: { id: kept.id } })).toMatchObject({ fromId: null, toId: keeper.id, openedAt: null });
  expect(await prisma.gift.findUnique({ where: { id: dropped.id } })).toBeNull();
  // Nothing is returned to the sender of a dropped gift (ruling 12): no gift_back row appears.
  expect(await prisma.itemGrant.count({ where: { userId: keeper.id, sourceKey: { startsWith: 'gift_back:' } } })).toBe(0);
});

it('entries and entry cheers go with their user (spec §12)', async () => {
  const [a, b] = [await buddyUser(), await buddyUser()];
  await prisma.challengeEntry.create({ data: { userId: a.id, weekId: '2026-W44', snapshot: {}, circle: [b.id] } });
  await prisma.challengeEntry.create({ data: { userId: b.id, weekId: '2026-W44', snapshot: {}, circle: [a.id] } });
  await prisma.challengeCheer.create({ data: { weekId: '2026-W44', fromId: b.id, toId: a.id } });
  await deleteUserAccount(a.id, noop);
  expect(await prisma.challengeEntry.count({ where: { userId: a.id } })).toBe(0);
  expect(await prisma.challengeCheer.count({ where: { OR: [{ fromId: a.id }, { toId: a.id }] } })).toBe(0);
  expect(await prisma.challengeEntry.count({ where: { userId: b.id } })).toBe(1);
});

it('a deleted user\'s id leaves every entry circle in every week; other ids and snapshots stay (PF4-F10)', async () => {
  const [gone, b, c, d] = [await buddyUser(), await buddyUser(), await buddyUser(), await buddyUser()];
  await prisma.challengeEntry.create({ data: { userId: b.id, weekId: '2026-W44', snapshot: { size: { n: 6, m: 6 } }, circle: [gone.id, c.id] } });
  await prisma.challengeEntry.create({ data: { userId: c.id, weekId: '2026-W45', snapshot: {}, circle: [b.id, gone.id] } });
  // A bystander whose circle never held the deleted user keeps it as it was.
  await prisma.challengeEntry.create({ data: { userId: d.id, weekId: '2026-W44', snapshot: {}, circle: [b.id, c.id] } });
  await deleteUserAccount(gone.id, noop);
  const entries = await prisma.challengeEntry.findMany({ where: { userId: { in: [b.id, c.id, d.id] } } });
  expect(Object.fromEntries(entries.map((e) => [e.userId, e.circle]))).toEqual({ [b.id]: [c.id], [c.id]: [b.id], [d.id]: [b.id, c.id] });
  expect(entries.find((e) => e.userId === b.id)!.snapshot).toEqual({ size: { n: 6, m: 6 } });
});

it('a failed highlights purge does not skip the circle purge, and the failure still reaches the caller (T2-CARRY)', async () => {
  const [gone, b] = [await buddyUser(), await buddyUser()];
  await prisma.challengeEntry.create({ data: { userId: b.id, weekId: '2026-W44', snapshot: {}, circle: [gone.id] } });
  const boom = new Error('highlights down');
  const db = {
    $executeRaw: ((sql: TemplateStringsArray, ...values: unknown[]) =>
      sql.join('').includes('WeeklyHighlights') ? Promise.reject(boom) : prisma.$executeRaw(sql, ...values)) as typeof prisma.$executeRaw,
  };
  await expect(purgeSocialJsonMentions(db, gone.id)).rejects.toBe(boom);
  expect((await prisma.challengeEntry.findFirstOrThrow({ where: { userId: b.id } })).circle).toEqual([]);
});
