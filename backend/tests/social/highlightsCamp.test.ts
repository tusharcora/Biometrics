import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { shiftDate } from '../../src/scoring/dates';
import { BUDDY_SHARING_CONSENT_VERSION } from '../../src/buddies/sharing';
import { getWeeklyHighlights } from '../../src/social/highlights';
import { buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-07T20:00:00Z'); // last final week: Mon 2026-09-28 .. Sun 2026-10-04
const WEEK = '2026-09-28';
const BEFORE = new Date('2026-09-01T00:00:00Z');
const day = (offset: number) => civilDateToUtcMidnight(shiftDate(WEEK, offset));
const noon = (offset: number) => new Date(day(offset).getTime() + 12 * 3_600_000);
const sharesStreaks = { shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION };
const goodnight = (authorId: string, offset: number, onTime = true) =>
  prisma.goodnight.create({ data: { authorId, localDate: day(offset), at: new Date(day(offset).getTime() + 22 * 3_600_000), onTime } });
const badge = (userId: string, family: 'STEP_GOAL' | 'SLEEP_GOAL', level: number, offset: number) =>
  prisma.achievement.create({ data: { userId, family, level, value: 7, earnedOn: day(offset), weekStart: day(0), monthStart: civilDateToUtcMidnight('2026-09-01') } });
const pairs = (items: Array<{ type: string; actor: { id: string } }>) => items.map((i) => [i.type, i.actor.id]);

it('an on-time goodnight every night is a top story, and two or more lit nights make a campfire item', async () => {
  const me = await buddyUser();
  const ana = await buddyUser({ displayName: 'Ana' });
  await pairUp(me.id, ana.id, BEFORE);
  for (let i = 0; i < 7; i++) await goodnight(ana.id, i);
  for (const i of [0, 1, 2]) await goodnight(me.id, i);
  await goodnight(me.id, 3, false); // late: not in bed on time
  const h = await getWeeklyHighlights(me.id, NOW);
  // A camp of 2: Mon–Wed 2 of 2 (5 segments), Thu–Sun 1 of 2 (3): all seven nights lit.
  expect(pairs(h!.items)).toEqual([['top_story', ana.id], ['campfire', me.id]]);
  expect(h!.items[0]).toMatchObject({ reason: 'on_time_every_night', mine: false });
  expect(h!.items[1]).toMatchObject({ nights: 7, mine: true });
});

it('one lit night is no campfire, and the quiet week is cached empty', async () => {
  const me = await buddyUser();
  const ana = await buddyUser();
  const ben = await buddyUser();
  await pairUp(me.id, ana.id, BEFORE);
  await pairUp(me.id, ben.id, BEFORE);
  // A camp of 3: Mon 2 of 3 (4 segments, lit), Tue 1 of 3 (2, not lit).
  await goodnight(ana.id, 0);
  await goodnight(ben.id, 0);
  await goodnight(ana.id, 1);
  expect(await getWeeklyHighlights(me.id, NOW)).toBeNull();
  expect(await prisma.weeklyHighlights.count({ where: { viewerId: me.id } })).toBe(1);
});

it('a buddy who paired midweek counts toward the fire only from that evening on', async () => {
  const me = await buddyUser();
  const ana = await buddyUser({ displayName: 'Ana' });
  const ben = await buddyUser({ displayName: 'Ben' });
  await pairUp(me.id, ana.id, BEFORE);
  await pairUp(me.id, ben.id, noon(3)); // Thursday noon, before Thursday's 19:00
  // Mon–Wed: Ana alone of {me, Ana} (1 of 2: 3 segments, lit). Thu–Sun: Ana and Ben of three (2 of 3: 4, lit).
  // Counted against all three, Mon–Wed would be 1 of 3 (2 segments, unlit): 4 nights, not 7.
  for (let i = 0; i < 7; i++) await goodnight(ana.id, i);
  for (let i = 3; i < 7; i++) await goodnight(ben.id, i);
  const h = await getWeeklyHighlights(me.id, NOW);
  expect(pairs(h!.items)).toEqual([['top_story', ana.id], ['campfire', me.id], ['joined', ben.id]]);
  expect(h!.items[1]).toMatchObject({ nights: 7 });
});

it('a buddy who paired with me that week "joined the camp"; one from before does not, and one unpaired since drops out', async () => {
  const me = await buddyUser();
  const sam = await buddyUser();
  const ana = await buddyUser();
  const ben = await buddyUser();
  await pairUp(me.id, sam.id, noon(2));
  await pairUp(me.id, ana.id, BEFORE);
  await pairUp(me.id, ben.id, noon(3));
  const first = await getWeeklyHighlights(me.id, NOW);
  expect(pairs(first!.items).sort()).toEqual([['joined', ben.id], ['joined', sam.id]].sort());
  await prisma.buddyPair.deleteMany({ where: { OR: [{ userAId: ben.id }, { userBId: ben.id }] } });
  expect(pairs((await getWeeklyHighlights(me.id, NOW))!.items)).toEqual([['joined', sam.id]]);
});

it("a member's first-ever badge that week shows while they share streaks, but not twice when it is the top story", async () => {
  const me = await buddyUser();
  const sam = await buddyUser({ displayName: 'Sam' });
  const ben = await buddyUser({ displayName: 'Ben' });
  const zoe = await buddyUser({ displayName: 'Zoe' });
  for (const u of [sam, ben, zoe]) {
    await pairUp(me.id, u.id, BEFORE);
    await prisma.user.update({ where: { id: u.id }, data: sharesStreaks });
  }
  await badge(sam.id, 'STEP_GOAL', 3, 2); // Sam's first badge, and the week's top story
  await badge(ben.id, 'SLEEP_GOAL', 1, 4); // Ben's first badge
  await badge(zoe.id, 'SLEEP_GOAL', 1, -10); // Zoe had one before the week...
  await badge(zoe.id, 'SLEEP_GOAL', 2, 5); // ...so this one is not a first
  expect(pairs((await getWeeklyHighlights(me.id, NOW))!.items)).toEqual([['top_story', sam.id], ['first_badge', ben.id]]);
  await prisma.user.update({ where: { id: ben.id }, data: { shareStreaks: false } });
  expect(pairs((await getWeeklyHighlights(me.id, NOW))!.items)).toEqual([['top_story', sam.id]]);
});

it('my own first badge shows without the streaks switch', async () => {
  const me = await buddyUser();
  const sam = await buddyUser();
  await pairUp(me.id, sam.id, BEFORE);
  await prisma.user.update({ where: { id: sam.id }, data: sharesStreaks });
  await badge(sam.id, 'SLEEP_GOAL', 3, 2); // the week's top story (Sam's first badge: not repeated)
  await badge(me.id, 'SLEEP_GOAL', 1, 3); // my first badge; I don't share streaks
  const h = await getWeeklyHighlights(me.id, NOW);
  expect(pairs(h!.items)).toEqual([['top_story', sam.id], ['first_badge', me.id]]);
  expect(h!.items[1]).toMatchObject({ mine: true });
});

it("an Auckland buddy's goodnight counts for the Los Angeles viewer's evening in which it was said (fix ruling I-1)", async () => {
  const me = await buddyUser({ timezone: 'America/Los_Angeles' });
  const ana = await buddyUser({ timezone: 'Pacific/Auckland' });
  const kai = await buddyUser({ timezone: 'Pacific/Auckland' });
  await pairUp(me.id, ana.id, BEFORE);
  await pairUp(me.id, kai.id, BEFORE);
  // 22:00 in Auckland (NZDT, UTC+13) on their Sunday and Monday is 02:00 in Los Angeles: my Saturday and Sunday
  // evenings. By their own evening dates only Sunday is in the week (one lit night, no campfire); by mine, two.
  const aucklandNight = (date: string) => ({ localDate: civilDateToUtcMidnight(date), at: new Date(`${date}T09:00:00Z`), onTime: true });
  for (const authorId of [ana.id, kai.id]) {
    for (const date of ['2026-10-04', '2026-10-05']) await prisma.goodnight.create({ data: { authorId, ...aucklandNight(date) } });
  }
  const h = await getWeeklyHighlights(me.id, NOW);
  expect(pairs(h!.items)).toEqual([['campfire', me.id]]);
  expect(h!.items[0]).toMatchObject({ nights: 2 });
});

it("'joined' follows the viewer's civil week, not UTC's (ruling P4)", async () => {
  const me = await buddyUser({ timezone: 'Pacific/Auckland' }); // NZDT, UTC+13
  const sam = await buddyUser();
  const ben = await buddyUser();
  await pairUp(me.id, sam.id, new Date('2026-09-27T12:00:00Z')); // Mon 28 Sep 01:00 in Auckland: that week
  await pairUp(me.id, ben.id, new Date('2026-10-04T12:00:00Z')); // Mon 5 Oct 01:00 in Auckland: the next week
  expect(pairs((await getWeeklyHighlights(me.id, NOW))!.items)).toEqual([['joined', sam.id]]);
});
