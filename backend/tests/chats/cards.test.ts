import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { BUDDY_SHARING_CONSENT_VERSION } from '../../src/buddies/sharing';
import { setBuddyNotifyQueue } from '../../src/buddies/notifyQueue';
import { buildCard, parseCardRequest } from '../../src/chats/cards';
import { sendMessage } from '../../src/chats/messages';
import { shareCampNote } from '../../src/social/campNotes';
import { saveCheckIn } from '../../src/social/checkins';
import { RecordingQueue, buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
beforeEach(() => setBuddyNotifyQueue(new RecordingQueue()));
afterEach(() => setBuddyNotifyQueue(null));

const NOW = new Date('2026-10-07T20:00:00Z'); // 20:00 for these UTC users
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const day = (d: string) => civilDateToUtcMidnight(d);
const sharesStreaks = { shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION };

async function buddies() {
  const me = await buddyUser({ displayName: 'Ana' });
  const sam = await buddyUser({ displayName: 'Sam' });
  await pairUp(me.id, sam.id);
  return { me, sam };
}

it('reads only the four request shapes', () => {
  expect(parseCardRequest({ type: 'my_checkin' })).toEqual({ type: 'my_checkin' });
  expect(parseCardRequest({ type: 'note', extra: 1 })).toEqual({ type: 'note' });
  expect(parseCardRequest({ type: 'camp_note' })).toEqual({ type: 'camp_note' });
  expect(parseCardRequest({ type: 'story_frame', at: '2026-10-07T16:00:00.000Z' })).toEqual({ type: 'story_frame', at: '2026-10-07T16:00:00.000Z' });
  for (const bad of [null, 'note', ['note'], { type: 'story_frame' }, { type: 'story_frame', at: 5 }, { type: 'checkin', mood: 'RESTED' }, {}]) {
    expect(parseCardRequest(bad)).toBeNull();
  }
});

it('my check-in card holds my mood today; without a check-in it is card_unavailable', async () => {
  const { me, sam } = await buddies();
  await expect(buildCard(me.id, sam.id, { type: 'my_checkin' }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
  await saveCheckIn(me.id, 'TIRED', hoursAgo(12));
  expect(await buildCard(me.id, sam.id, { type: 'my_checkin' }, NOW)).toEqual({ type: 'checkin', about: 'sender', localDate: '2026-10-07', mood: 'TIRED' });
});

it("a reply to their check-in frame keeps no mood while it is locked for me, and the mood once I've checked in", async () => {
  const { me, sam } = await buddies();
  await saveCheckIn(sam.id, 'RESTED', hoursAgo(4));
  const at = hoursAgo(4).toISOString();
  expect(await buildCard(me.id, sam.id, { type: 'story_frame', at }, NOW)).toEqual({ type: 'checkin', about: 'recipient', localDate: '2026-10-07', mood: null });
  await saveCheckIn(me.id, 'OKAY', hoursAgo(3));
  expect(await buildCard(me.id, sam.id, { type: 'story_frame', at }, NOW)).toEqual({ type: 'checkin', about: 'recipient', localDate: '2026-10-07', mood: 'RESTED' });
  await expect(buildCard(me.id, sam.id, { type: 'story_frame', at: hoursAgo(1).toISOString() }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
});

it('a badge frame is quoted only while its author shares streaks; a goodnight frame keeps its on-time flag', async () => {
  const { me, sam } = await buddies();
  await prisma.user.update({ where: { id: sam.id }, data: sharesStreaks });
  const badgeAt = hoursAgo(2);
  await prisma.achievement.create({
    data: { userId: sam.id, family: 'SLEEP_GOAL', level: 2, value: 7, earnedOn: day('2026-10-07'), weekStart: day('2026-10-05'), monthStart: day('2026-10-01'), createdAt: badgeAt },
  });
  expect(await buildCard(me.id, sam.id, { type: 'story_frame', at: badgeAt.toISOString() }, NOW)).toEqual({ type: 'badge', family: 'SLEEP_GOAL', level: 2 });
  await prisma.user.update({ where: { id: sam.id }, data: { shareStreaks: false } });
  await expect(buildCard(me.id, sam.id, { type: 'story_frame', at: badgeAt.toISOString() }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
  const goodnightAt = hoursAgo(1);
  await prisma.goodnight.create({ data: { authorId: sam.id, localDate: day('2026-10-07'), at: goodnightAt, onTime: true } });
  expect(await buildCard(me.id, sam.id, { type: 'story_frame', at: goodnightAt.toISOString() }, NOW)).toEqual({ type: 'goodnight', onTime: true });
});

it("quotes their live Chats note and their live camp note; an expired or cleared one is card_unavailable", async () => {
  const { me, sam } = await buddies();
  await expect(buildCard(me.id, sam.id, { type: 'note' }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
  await prisma.statusNote.create({ data: { authorId: sam.id, text: 'early night tonight', createdAt: hoursAgo(1), expiresAt: new Date(NOW.getTime() + 3_600_000) } });
  expect(await buildCard(me.id, sam.id, { type: 'note' }, NOW)).toEqual({ type: 'note', text: 'early night tonight' });
  await expect(buildCard(me.id, sam.id, { type: 'note' }, new Date(NOW.getTime() + 2 * 3_600_000))).rejects.toMatchObject({ code: 'card_unavailable' });
  await shareCampNote(sam.id, 'bed soon', hoursAgo(1));
  expect(await buildCard(me.id, sam.id, { type: 'camp_note' }, NOW)).toEqual({ type: 'camp_note', text: 'bed soon' });
  await saveCheckIn(sam.id, 'RESTED', NOW); // a check-in after the note clears it
  await expect(buildCard(me.id, sam.id, { type: 'camp_note' }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
});

it("never quotes a stranger's anything: not_buddies", async () => {
  const me = await buddyUser();
  const stranger = await buddyUser();
  await prisma.statusNote.create({ data: { authorId: stranger.id, text: 'hello world', expiresAt: new Date(NOW.getTime() + 3_600_000) } });
  await shareCampNote(stranger.id, 'bed soon', hoursAgo(1));
  await saveCheckIn(stranger.id, 'RESTED', hoursAgo(4));
  for (const req of [{ type: 'note' as const }, { type: 'camp_note' as const }, { type: 'story_frame' as const, at: hoursAgo(4).toISOString() }]) {
    await expect(buildCard(me.id, stranger.id, req, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  }
});

it('sends a CARD, with or without a reply text; a bad card or a blank text is invalid_message', async () => {
  const { me, sam } = await buddies();
  await saveCheckIn(me.id, 'RESTED', hoursAgo(12));
  const plain = await sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'my_checkin' } }, NOW);
  expect(plain).toMatchObject({ kind: 'CARD', text: null, card: { type: 'checkin', about: 'sender', mood: 'RESTED' } });
  await prisma.statusNote.create({ data: { authorId: sam.id, text: 'early night tonight', expiresAt: new Date(NOW.getTime() + 3_600_000) } });
  const reply = await sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'note' }, text: ' same here ' }, NOW);
  expect(reply).toMatchObject({ kind: 'CARD', text: 'same here', card: { type: 'note', text: 'early night tonight' } });
  for (const body of [{ kind: 'CARD' }, { kind: 'CARD', card: { type: 'checkin', mood: 'TIRED' } }, { kind: 'CARD', card: { type: 'note' }, text: '   ' }]) {
    await expect(sendMessage(me.id, sam.id, body, NOW)).rejects.toMatchObject({ code: 'invalid_message' });
  }
  const stored = await prisma.message.findUniqueOrThrow({ where: { id: plain.id } });
  expect(stored.card).toEqual({ type: 'checkin', about: 'sender', localDate: '2026-10-07', mood: 'RESTED' });
});

it('my own check-in is never quoted to a stranger or to myself: not_buddies, with or without a check-in', async () => {
  const me = await buddyUser();
  const stranger = await buddyUser();
  await expect(buildCard(me.id, stranger.id, { type: 'my_checkin' }, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  await saveCheckIn(me.id, 'RESTED', hoursAgo(12));
  await expect(buildCard(me.id, stranger.id, { type: 'my_checkin' }, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  await expect(buildCard(me.id, me.id, { type: 'my_checkin' }, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  await expect(buildCard(me.id, 'not-a-uuid', { type: 'note' }, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  await expect(sendMessage(me.id, stranger.id, { kind: 'CARD', card: { type: 'my_checkin' } }, NOW)).rejects.toMatchObject({ code: 'not_buddies' });
  expect(await prisma.message.count({ where: { senderId: me.id } })).toBe(0);
});

it('a frame is named by its time in any ISO spelling; an unreadable time is card_unavailable', async () => {
  const { me, sam } = await buddies();
  await saveCheckIn(me.id, 'OKAY', hoursAgo(5));
  await saveCheckIn(sam.id, 'TIRED', new Date('2026-10-07T16:00:00Z'));
  expect(await buildCard(me.id, sam.id, { type: 'story_frame', at: '2026-10-07T16:00:00Z' }, NOW)).toMatchObject({ type: 'checkin', mood: 'TIRED' });
  await expect(buildCard(me.id, sam.id, { type: 'story_frame', at: 'yesterday' }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
});

it('a reply text that is not text, or holds a lone surrogate, is invalid_message and nothing is stored', async () => {
  const { me, sam } = await buddies();
  await saveCheckIn(me.id, 'RESTED', hoursAgo(12));
  for (const text of ['hi \uD800', 5, '']) {
    await expect(sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'my_checkin' }, text }, NOW)).rejects.toMatchObject({ code: 'invalid_message' });
  }
  expect(await prisma.message.count({ where: { senderId: me.id } })).toBe(0);
});

// Tripwire only: it sees console calls on this path in this process. The real check is the backend-wide grep (Task 19).
it('never logs the quoted note or the reply text (tripwire)', async () => {
  const { me, sam } = await buddies();
  const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  await prisma.statusNote.create({ data: { authorId: sam.id, text: 'secret note words', expiresAt: new Date(NOW.getTime() + 3_600_000) } });
  await sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'note' }, text: 'secret reply words' }, NOW);
  await expect(sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'camp_note' }, text: 'secret reply words' }, NOW)).rejects.toMatchObject({ code: 'card_unavailable' });
  for (const spy of spies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/secret (note|reply)/);
});
