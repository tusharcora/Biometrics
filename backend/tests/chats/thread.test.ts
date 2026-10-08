import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { orderedPair } from '../../src/buddies/pairs';
import { setBuddyNotifyQueue } from '../../src/buddies/notifyQueue';
import { BUDDY_SHARING_CONSENT_VERSION } from '../../src/buddies/sharing';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { listThread, markRead, sendMessage } from '../../src/chats/messages';
import { activeAtFor, touchPresence } from '../../src/chats/presence';
import { RecordingQueue, api, buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
beforeEach(() => setBuddyNotifyQueue(new RecordingQueue()));
afterEach(() => setBuddyNotifyQueue(null));

const NOW = new Date('2026-10-08T18:00:00Z');
const at = (min: number) => new Date(NOW.getTime() + min * 60_000);

async function buddies() {
  const me = await buddyUser({ displayName: 'Ana' });
  const sam = await buddyUser({ displayName: 'Sam' });
  await pairUp(me.id, sam.id);
  return { me, sam };
}
/** Messages written straight to the table (the limiter is not under test here), one a minute from `from`. */
async function seed(me: string, sam: string, count: number, from = 0) {
  const conversation = await prisma.conversation.upsert({ where: { userAId_userBId: orderedPair(me, sam) }, create: orderedPair(me, sam), update: {} });
  await prisma.message.createMany({
    data: Array.from({ length: count }, (_, i) => ({ conversationId: conversation.id, senderId: i % 2 === 0 ? sam : me, kind: 'TEXT' as const, text: `m${from + i}`, createdAt: at(from + i) })),
  });
  return conversation.id;
}

it('pages 50 at a time, oldest first on the wire, with a cursor for the page before; unsent messages never show', async () => {
  const { me, sam } = await buddies();
  const conversationId = await seed(me.id, sam.id, 53);
  await prisma.message.updateMany({ where: { conversationId, text: 'm52' }, data: { deletedAt: at(60), text: null } });
  // 52 visible (m0..m51): the newest 50 are m2..m51, the page before holds m0 and m1.
  const newest = await listThread(me.id, sam.id, undefined, at(100));
  expect(newest.messages.map((m) => m.text)).toEqual(Array.from({ length: 50 }, (_, i) => `m${i + 2}`));
  expect(newest.nextBefore).toEqual(expect.any(String));
  const older = await listThread(me.id, sam.id, newest.nextBefore, at(100));
  expect([older.messages.map((m) => m.text), older.nextBefore]).toEqual([['m0', 'm1'], null]);
  expect(newest.buddy).toEqual({ id: sam.id, handle: sam.handle, displayName: 'Sam', coachId: expect.any(String) });
  expect(newest.messages.find((m) => m.text === 'm2')!.mine).toBe(false);
  expect(newest.messages.find((m) => m.text === 'm3')!.mine).toBe(true);
});

it('a pair with no messages yet reads as an empty thread; a bad cursor is invalid_cursor', async () => {
  const { me, sam } = await buddies();
  expect(await listThread(me.id, sam.id, undefined, NOW)).toEqual({
    buddy: expect.objectContaining({ id: sam.id }), messages: [], nextBefore: null, seenAt: null, activeAt: null,
  });
  await expect(listThread(me.id, sam.id, 'not-a-cursor', NOW)).rejects.toMatchObject({ code: 'invalid_cursor' });
});

it('"Seen" is the buddy\'s last read, sent only while both have read receipts on', async () => {
  const { me, sam } = await buddies();
  await sendMessage(me.id, sam.id, { kind: 'TEXT', text: 'early night?' }, NOW);
  expect((await listThread(me.id, sam.id, undefined, at(1))).seenAt).toBeNull();
  await markRead(sam.id, me.id, at(2));
  expect((await listThread(me.id, sam.id, undefined, at(3))).seenAt).toBe(at(2).toISOString());
  // Never backwards: an older read lands late.
  await markRead(sam.id, me.id, at(1));
  expect((await listThread(me.id, sam.id, undefined, at(3))).seenAt).toBe(at(2).toISOString());
  // Either person off hides it both ways (reciprocal).
  for (const who of [sam.id, me.id]) {
    await prisma.user.update({ where: { id: who }, data: { chatReadReceipts: false } });
    expect([who, (await listThread(me.id, sam.id, undefined, at(3))).seenAt]).toEqual([who, null]);
    await prisma.user.update({ where: { id: who }, data: { chatReadReceipts: true } });
  }
  expect((await listThread(me.id, sam.id, undefined, at(3))).seenAt).toBe(at(2).toISOString());
});

it('reading moves my read and marks their stickers seen, even before any message', async () => {
  const { me, sam } = await buddies();
  await prisma.sticker.create({ data: { fromUserId: sam.id, toUserId: me.id, kind: 'CHEER', sentAt: NOW } });
  await markRead(me.id, sam.id, at(1));
  expect(await prisma.sticker.count({ where: { toUserId: me.id, seenAt: null } })).toBe(0);
  await sendMessage(sam.id, me.id, { kind: 'TEXT', text: 'hi' }, at(2));
  await markRead(me.id, sam.id, at(3));
  const read = await prisma.conversationRead.findFirstOrThrow({ where: { readerId: me.id } });
  expect(read.lastReadAt.toISOString()).toBe(at(3).toISOString());
});

it('activity status: touched at most once a minute, shown within 24 h only while both share it', async () => {
  const { me, sam } = await buddies();
  await touchPresence(sam.id, NOW);
  await touchPresence(sam.id, at(0.5)); // within the minute: unchanged
  expect((await prisma.user.findUniqueOrThrow({ where: { id: sam.id } })).lastActiveAt?.toISOString()).toBe(NOW.toISOString());
  await touchPresence(sam.id, at(1));
  expect((await prisma.user.findUniqueOrThrow({ where: { id: sam.id } })).lastActiveAt?.toISOString()).toBe(at(1).toISOString());
  expect((await listThread(me.id, sam.id, undefined, at(5))).activeAt).toBe(at(1).toISOString());
  expect((await listThread(me.id, sam.id, undefined, at(1 + 24 * 60 + 1))).activeAt).toBeNull();
  await prisma.user.update({ where: { id: me.id }, data: { chatActivityStatus: false } });
  expect((await listThread(me.id, sam.id, undefined, at(5))).activeAt).toBeNull();
  // Pure rule, both ways.
  const seenAt = { chatActivityStatus: true, lastActiveAt: NOW };
  expect(activeAtFor({ chatActivityStatus: true }, seenAt, at(10))).toBe(NOW.toISOString());
  expect(activeAtFor({ chatActivityStatus: true }, { ...seenAt, chatActivityStatus: false }, at(10))).toBeNull();
  expect(activeAtFor({ chatActivityStatus: false }, seenAt, at(10))).toBeNull();
  expect(activeAtFor({ chatActivityStatus: true }, { chatActivityStatus: true, lastActiveAt: null }, at(10))).toBeNull();
});

it('reading a thread and sending touch my presence', async () => {
  const { me, sam } = await buddies();
  await listThread(me.id, sam.id, undefined, NOW);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).lastActiveAt?.toISOString()).toBe(NOW.toISOString());
  await sendMessage(sam.id, me.id, { kind: 'TEXT', text: 'hi' }, at(2));
  expect((await prisma.user.findUniqueOrThrow({ where: { id: sam.id } })).lastActiveAt?.toISOString()).toBe(at(2).toISOString());
});

it('routes: GET messages and POST read answer not_buddies for a stranger; settings read and save; presence is 204', async () => {
  const { me, sam } = await buddies();
  const stranger = await buddyUser();
  const agent = await api();
  const headers = await authHeaderFor(me.id);
  const thread = await agent.get(`/me/chats/${sam.id}/messages`).set(headers);
  expect([thread.status, thread.headers['cache-control'], Object.keys(thread.body).sort()]).toEqual([200, 'private, no-store', ['activeAt', 'buddy', 'messages', 'nextBefore', 'seenAt']]);
  for (const path of [`/me/chats/${stranger.id}/messages`, '/me/chats/nope/messages', `/me/chats/${me.id}/messages`]) {
    const res = await agent.get(path).set(headers);
    expect([path, res.status, res.body]).toEqual([path, 403, { error: 'not_buddies' }]);
  }
  expect((await agent.post(`/me/chats/${sam.id}/read`).set(headers)).status).toBe(204);
  expect((await agent.post(`/me/chats/${stranger.id}/read`).set(headers)).body).toEqual({ error: 'not_buddies' });
  expect((await agent.get(`/me/chats/${sam.id}/messages?before=junk`).set(headers)).body).toEqual({ error: 'invalid_cursor' });
  expect((await agent.get('/me/chats/settings').set(headers)).body).toEqual({ readReceipts: true, activityStatus: true });
  expect((await agent.put('/me/chats/settings').set(headers).send({ readReceipts: false })).body).toEqual({ readReceipts: false, activityStatus: true });
  for (const bad of [{}, { readReceipts: 'no' }, { typing: true }]) {
    expect((await agent.put('/me/chats/settings').set(headers).send(bad)).body).toEqual({ error: 'invalid_settings' });
  }
  expect((await agent.post('/me/presence').set(headers)).status).toBe(204);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).lastActiveAt).not.toBeNull();
});

// Card gate (Task 5 fix): a page serves a card's number only while it is still shared, like a single read.
it('a badge card in a page serves its level only while its author still shares streaks', async () => {
  const { me, sam } = await buddies();
  await prisma.user.update({ where: { id: sam.id }, data: { shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION } });
  const badgeAt = at(-120);
  const day = civilDateToUtcMidnight;
  await prisma.achievement.create({
    data: { userId: sam.id, family: 'SLEEP_GOAL', level: 3, value: 14, earnedOn: day('2026-10-08'), weekStart: day('2026-10-05'), monthStart: day('2026-10-01'), createdAt: badgeAt },
  });
  await sendMessage(me.id, sam.id, { kind: 'TEXT', text: 'look' }, NOW);
  await sendMessage(me.id, sam.id, { kind: 'CARD', card: { type: 'story_frame', at: badgeAt.toISOString() } }, at(1));
  const cardOf = async (viewer: string, buddy: string) => (await listThread(viewer, buddy, undefined, at(2))).messages.find((m) => m.kind === 'CARD')!.card;
  expect(await cardOf(me.id, sam.id)).toEqual({ type: 'badge', available: true, family: 'SLEEP_GOAL', level: 3 });
  await prisma.user.update({ where: { id: sam.id }, data: { shareStreaks: false } });
  for (const [viewer, buddy] of [[me.id, sam.id], [sam.id, me.id]]) {
    expect(await cardOf(viewer, buddy)).toEqual({ type: 'badge', available: false, family: 'SLEEP_GOAL' });
  }
});
