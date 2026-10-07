import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { sayGoodnight, undoGoodnight } from '../../src/social/goodnight';
import { api, buddyUser } from '../buddies/helpers';
import { zoneAtLocalHour } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const LA = 'America/Los_Angeles'; // PDT, UTC−7
const at = (iso: string) => new Date(iso);
const withGoal = async (goal: string | null) => {
  const u = await buddyUser({ timezone: LA });
  if (goal) await prisma.user.update({ where: { id: u.id }, data: { bedtimeGoal: goal } });
  return u;
};

it('says goodnight once per evening, on time by the bedtime goal + 15 min; a second tap keeps the first', async () => {
  const me = await withGoal('22:30');
  const first = at('2026-10-08T05:44:00Z'); // 22:44
  expect(await sayGoodnight(me.id, first)).toEqual({ localDate: '2026-10-07', at: first.toISOString(), onTime: true, undoUntil: '2026-10-08T05:54:00.000Z' });
  expect((await sayGoodnight(me.id, at('2026-10-08T06:30:00Z'))).at).toBe(first.toISOString()); // 23:30, same evening
  expect(await prisma.goodnight.count({ where: { authorId: me.id } })).toBe(1);
});

it('is late after goal + 15 min, uses 23:00 without a goal, and a goodnight after midnight belongs to the evening before', async () => {
  expect((await sayGoodnight((await withGoal('22:30')).id, at('2026-10-08T05:46:00Z'))).onTime).toBe(false); // 22:46
  expect((await sayGoodnight((await withGoal(null)).id, at('2026-10-08T06:00:00Z'))).onTime).toBe(true); // 23:00
  expect((await sayGoodnight((await withGoal(null)).id, at('2026-10-08T06:01:00Z'))).onTime).toBe(false); // 23:01
  const late = await sayGoodnight((await withGoal(null)).id, at('2026-10-08T07:30:00Z')); // 00:30 Oct 8
  expect([late.localDate, late.onTime]).toEqual(['2026-10-07', false]);
  expect((await sayGoodnight((await withGoal('00:30')).id, at('2026-10-08T07:40:00Z'))).onTime).toBe(true); // 00:40
});

it('with no goal it opens at 20:00 (19:30 is closed though the scene is night) and closes at 06:00', async () => {
  await expect(sayGoodnight((await withGoal(null)).id, at('2026-10-08T02:30:00Z'))).rejects.toMatchObject({ code: 'goodnight_closed' }); // 19:30
  await expect(sayGoodnight((await withGoal(null)).id, at('2026-10-08T03:00:00Z'))).resolves.toMatchObject({ localDate: '2026-10-07' }); // 20:00
  await expect(sayGoodnight((await withGoal(null)).id, at('2026-10-08T12:59:00Z'))).resolves.toMatchObject({ localDate: '2026-10-07' }); // 05:59
  const closed = await withGoal(null);
  await expect(sayGoodnight(closed.id, at('2026-10-08T13:00:00Z'))).rejects.toMatchObject({ code: 'goodnight_closed' }); // 06:00
  expect(await prisma.goodnight.count({ where: { authorId: closed.id } })).toBe(0);
});

it('opens an hour before an earlier goal: an 18:00 goal opens at 17:00 and 18:05 is on time; a 23:00 goal opens at 20:00', async () => {
  await expect(sayGoodnight((await withGoal('18:00')).id, at('2026-10-07T23:59:00Z'))).rejects.toMatchObject({ code: 'goodnight_closed' }); // 16:59
  await expect(sayGoodnight((await withGoal('18:00')).id, at('2026-10-08T00:00:00Z'))).resolves.toMatchObject({ localDate: '2026-10-07', onTime: true }); // 17:00
  expect(await sayGoodnight((await withGoal('18:00')).id, at('2026-10-08T01:05:00Z'))).toMatchObject({ localDate: '2026-10-07', onTime: true }); // 18:05
  await expect(sayGoodnight((await withGoal('23:00')).id, at('2026-10-08T02:59:00Z'))).rejects.toMatchObject({ code: 'goodnight_closed' }); // 19:59
  await expect(sayGoodnight((await withGoal('23:00')).id, at('2026-10-08T03:00:00Z'))).resolves.toMatchObject({ onTime: true }); // 20:00
});

it('undo within 10 minutes deletes it; a millisecond later is undo_expired; nothing to undo is fine', async () => {
  const me = await withGoal(null);
  const said = at('2026-10-08T05:44:00Z');
  await sayGoodnight(me.id, said);
  await undoGoodnight(me.id, new Date(said.getTime() + 10 * 60_000));
  expect(await prisma.goodnight.count({ where: { authorId: me.id } })).toBe(0);
  await sayGoodnight(me.id, said);
  await expect(undoGoodnight(me.id, new Date(said.getTime() + 10 * 60_000 + 1))).rejects.toMatchObject({ code: 'undo_expired' });
  expect(await prisma.goodnight.count({ where: { authorId: me.id } })).toBe(1);
  await expect(undoGoodnight((await withGoal(null)).id, said)).resolves.toBeUndefined();
});

it("undo after 06:00 never removes last night's goodnight, even inside its 10 minutes", async () => {
  const me = await withGoal(null);
  await sayGoodnight(me.id, at('2026-10-08T12:55:00Z')); // 05:55 Oct 8: the evening of Oct 7
  // 06:01 Oct 8: the current evening is Oct 8, which has no goodnight, so there is nothing to undo.
  await expect(undoGoodnight(me.id, at('2026-10-08T13:01:00Z'))).resolves.toBeUndefined();
  expect(await prisma.goodnight.count({ where: { authorId: me.id } })).toBe(1);
});

it('routes: POST answers the goodnight (the same one twice), DELETE undoes with 204; by day it is 409 goodnight_closed', async () => {
  const agent = await api();
  const night = await buddyUser({ timezone: zoneAtLocalHour(22) });
  const headers = await authHeaderFor(night.id);
  const said = await agent.post('/me/camp/goodnight').set(headers);
  expect(said.status).toBe(200);
  expect(Object.keys(said.body.goodnight).sort()).toEqual(['at', 'localDate', 'onTime', 'undoUntil']);
  expect((await agent.post('/me/camp/goodnight').set(headers)).body.goodnight.at).toBe(said.body.goodnight.at);
  expect((await agent.delete('/me/camp/goodnight').set(headers)).status).toBe(204);
  expect(await prisma.goodnight.count({ where: { authorId: night.id } })).toBe(0);
  const day = await buddyUser({ timezone: zoneAtLocalHour(12) });
  const closed = await agent.post('/me/camp/goodnight').set(await authHeaderFor(day.id));
  expect([closed.status, closed.body]).toEqual([409, { error: 'goodnight_closed' }]);
  expect((await agent.post('/me/camp/goodnight')).status).toBe(401);
});
