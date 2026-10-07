import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { BUDDY_SHARING_CONSENT_VERSION } from '../../src/buddies/sharing';
import { getStory, loadStoryRings, markStorySeen } from '../../src/social/stories';
import { saveCheckIn } from '../../src/social/checkins';
import { api, buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-07T20:00:00Z');
const day = (d: string) => civilDateToUtcMidnight(d);
const sharesStreaks = { shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION };

async function badge(userId: string, at: Date) {
  return prisma.achievement.create({
    data: { userId, family: 'SLEEP_GOAL', level: 2, value: 7, earnedOn: day('2026-10-07'), weekStart: day('2026-10-05'), monthStart: day('2026-10-01'), createdAt: at },
  });
}

it("shows a buddy's ring locked until I check in, then their mood; badges only while they share streaks", async () => {
  const me = await buddyUser();
  const sam = await buddyUser({ displayName: 'Sam' });
  await pairUp(me.id, sam.id);
  await prisma.user.update({ where: { id: sam.id }, data: sharesStreaks });
  await saveCheckIn(sam.id, 'TIRED', new Date(NOW.getTime() - 3_600_000));
  await badge(sam.id, new Date(NOW.getTime() - 1_800_000));

  const first = await loadStoryRings(me.id, NOW);
  let { rings } = first;
  expect(rings.map((r) => [r.author.id, r.unseen, r.locked, r.frameCount])).toEqual([[sam.id, true, true, 2]]);
  expect([first.checkedInBuddies, first.viewerCheckedIn, first.checkedInCoachIds]).toEqual([1, false, [rings[0]!.author.coachId]]);
  const locked = await getStory(me.id, sam.id, NOW);
  expect(locked.frames[0]).toEqual({ kind: 'checkin', at: expect.any(String), locked: true });
  expect(locked.frames[1]).toMatchObject({ kind: 'badge', family: 'SLEEP_GOAL', level: 2 });

  await saveCheckIn(me.id, 'RESTED', NOW);
  ({ rings } = await loadStoryRings(me.id, NOW));
  expect(rings[0]!.locked).toBe(false);
  expect((await getStory(me.id, sam.id, NOW)).frames[0]).toEqual({ kind: 'checkin', at: expect.any(String), locked: false, mood: 'TIRED' });

  await prisma.user.update({ where: { id: sam.id }, data: { shareStreaks: false } });
  expect((await getStory(me.id, sam.id, NOW)).frames.map((f) => f.kind)).toEqual(['checkin']);
});

it("follows the author's local day across time zones", async () => {
  const me = await buddyUser({ timezone: 'America/Los_Angeles' });
  const kiwi = await buddyUser({ timezone: 'Pacific/Auckland' });
  await pairUp(me.id, kiwi.id);
  const nzMorning = new Date('2026-10-07T19:00:00Z'); // Oct 8 08:00 in Auckland, Oct 7 12:00 in LA
  await saveCheckIn(kiwi.id, 'OKAY', nzMorning);
  expect((await loadStoryRings(me.id, nzMorning)).rings).toHaveLength(1);
  const nzNextDay = new Date('2026-10-08T11:30:00Z'); // Oct 9 00:30 in Auckland
  expect((await loadStoryRings(me.id, nzNextDay)).rings).toHaveLength(0);
});

it('a shared recap frame carries its headline line as previewed, period and coach — never the stats JSON', async () => {
  const me = await buddyUser();
  const ana = await buddyUser();
  await pairUp(me.id, ana.id);
  const recap = await prisma.recap.create({
    data: { userId: ana.id, kind: 'WEEK', periodStart: day('2026-09-28'), periodEnd: day('2026-10-04'), status: 'BUILT', sleepGoalMinutes: 480, line: 'A steadier week', lineSource: 'TEMPLATE', stats: { avgSleep: 431 } },
  });
  await prisma.recapShare.create({ data: { sharerId: ana.id, recapId: recap.id, localDate: day('2026-10-07'), createdAt: NOW } });
  const frame = (await getStory(me.id, ana.id, NOW)).frames.find((f) => f.kind === 'recap');
  expect(Object.keys(frame!).sort()).toEqual(['at', 'coachId', 'kind', 'line', 'periodEnd', 'periodStart', 'recapId', 'recapKind']);
  expect(frame).toMatchObject({ line: 'A steadier week' });
  // The line is consented to at share time; the stats JSON never leaves the recap.
  expect(JSON.stringify(frame)).not.toContain('431');
});

it('seen clears the ring; a non-buddy (or after unpair) is not_buddies', async () => {
  const me = await buddyUser();
  const ben = await buddyUser();
  const stranger = await buddyUser();
  await pairUp(me.id, ben.id);
  await saveCheckIn(ben.id, 'RESTED', NOW);
  await saveCheckIn(stranger.id, 'RESTED', NOW);
  await markStorySeen(me.id, ben.id, NOW);
  expect((await loadStoryRings(me.id, NOW)).rings.map((r) => r.unseen)).toEqual([false]);
  await expect(getStory(me.id, stranger.id, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  await prisma.buddyPair.deleteMany({ where: { OR: [{ userAId: me.id }, { userBId: me.id }] } });
  expect((await loadStoryRings(me.id, NOW)).rings).toEqual([]);
  const agent = await api();
  const res = await agent.get(`/me/social/stories/${ben.id}`).set(await authHeaderFor(me.id));
  expect([res.status, res.body]).toEqual([403, { error: 'not_buddies' }]);
  expect((await agent.get('/me/social/stories/not-a-uuid').set(await authHeaderFor(me.id))).body).toEqual({ error: 'not_buddies' });
});

it('my own story is readable and never locked', async () => {
  const me = await buddyUser();
  await saveCheckIn(me.id, 'OKAY', NOW);
  expect((await getStory(me.id, me.id, NOW)).frames).toEqual([{ kind: 'checkin', at: expect.any(String), locked: false, mood: 'OKAY' }]);
});
