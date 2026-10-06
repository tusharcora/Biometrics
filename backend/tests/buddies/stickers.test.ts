import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { setBuddyNotifyQueue } from '../../src/buddies/notifyQueue';
import { sendSticker } from '../../src/buddies/stickers';
import { listBuddies } from '../../src/buddies/list';
import { RecordingQueue, RecordingSender, addToken, api, buddyUser, pairUp } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let sender: RecordingSender;
let queue: RecordingQueue;
beforeEach(() => {
  sender = new RecordingSender();
  queue = new RecordingQueue();
  setBuddyNotifyQueue(queue);
});
afterEach(() => setBuddyNotifyQueue(null));

const post = async (from: string, to: string, kind: unknown) => (await api()).post(`/me/buddies/${to}/stickers`).set(await authHeaderFor(from)).send({ kind });

it('sends a sticker: a row, STICKER Activity with the sticker id, a bumped pair, and the named push with the sender id', async () => {
  const me = await buddyUser({ displayName: 'Ana' });
  const buddy = await buddyUser();
  const other = await buddyUser();
  await addToken(buddy.id);
  const old = new Date(Date.now() - 3_600_000);
  await pairUp(me.id, buddy.id, old);
  await pairUp(buddy.id, other.id, new Date(Date.now() - 60_000));

  const res = await post(me.id, buddy.id, 'HEART');
  expect(res.status).toBe(201);
  const sticker = await prisma.sticker.findUniqueOrThrow({ where: { id: res.body.id } });
  expect([sticker.fromUserId, sticker.toUserId, sticker.kind]).toEqual([me.id, buddy.id, 'HEART']);
  expect(await prisma.buddyActivity.count({ where: { recipientId: buddy.id, actorId: me.id, kind: 'STICKER', refId: sticker.id } })).toBe(1);
  await queue.drain(sender);
  expect(sender.calls.map((c) => [c.payload.title, c.payload.data])).toEqual([['Ana sent you a Heart', { kind: 'buddy_sticker', refId: me.id }]]);
  // The buddy's list now shows me first (bumped lastActivityAt), with the unseen flag.
  const page = await listBuddies(buddy.id, undefined, new Date());
  expect(page.buddies.map((b) => [b.id, b.unseenSticker])).toEqual([[me.id, true], [other.id, false]]);
});

it('a muted sender still records Activity but pushes nothing', async () => {
  const me = await buddyUser();
  const buddy = await buddyUser();
  await addToken(buddy.id);
  await pairUp(me.id, buddy.id);
  await prisma.buddyMute.create({ data: { muterId: buddy.id, mutedId: me.id } });
  expect((await post(me.id, buddy.id, 'STAR')).status).toBe(201);
  expect(await prisma.buddyActivity.count({ where: { recipientId: buddy.id, kind: 'STICKER' } })).toBe(1);
  await queue.drain(sender);
  expect(sender.calls).toHaveLength(0);
});

it('a muted and an unmuted sticker run the same route path: one job of the same shape each', async () => {
  const muted = await buddyUser();
  const plain = await buddyUser();
  const buddy = await buddyUser();
  await addToken(buddy.id);
  await pairUp(muted.id, buddy.id);
  await pairUp(plain.id, buddy.id);
  await prisma.buddyMute.create({ data: { muterId: buddy.id, mutedId: muted.id } });
  const a = await post(muted.id, buddy.id, 'STAR');
  const b = await post(plain.id, buddy.id, 'STAR');
  expect([a.status, b.status]).toEqual([201, 201]);
  const shape = (j: { name: string; data: object; opts: unknown }) => [j.name, Object.keys(j.data).sort(), j.opts, (j.data as { kind: string }).kind];
  expect(queue.jobs).toHaveLength(2);
  expect(shape(queue.jobs[0]!)).toEqual(shape(queue.jobs[1]!));
  await queue.drain(sender);
  expect(sender.calls.map((c) => c.payload.data)).toEqual([{ kind: 'buddy_sticker', refId: plain.id }]);
});

it('a hanging enqueue never hangs the sticker route', async () => {
  const me = await buddyUser();
  const buddy = await buddyUser();
  await pairUp(me.id, buddy.id);
  setBuddyNotifyQueue({ add: () => new Promise(() => {}) });
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const started = Date.now();
  expect((await post(me.id, buddy.id, 'CHEER')).status).toBe(201);
  expect(Date.now() - started).toBeLessThan(5000);
  expect(errors.mock.calls.map((c) => JSON.parse(String(c[0])).event)).toContain('buddies.notify_enqueue_failed');
  errors.mockRestore();
});

it('refuses an unknown kind, a non-buddy, and a buddy who just unpaired, storing nothing', async () => {
  const me = await buddyUser();
  const buddy = await buddyUser();
  const stranger = await buddyUser();
  await pairUp(me.id, buddy.id);
  expect((await post(me.id, buddy.id, 'KISS')).body).toEqual({ error: 'invalid_sticker' });
  const no = await post(me.id, stranger.id, 'STAR');
  expect([no.status, no.body]).toEqual([403, { error: 'not_buddies' }]);
  await (await api()).delete(`/me/buddies/${me.id}`).set(await authHeaderFor(buddy.id));
  expect((await post(me.id, buddy.id, 'STAR')).body).toEqual({ error: 'not_buddies' });
  expect(await prisma.sticker.count({ where: { fromUserId: me.id } })).toBe(0);
});

it("the daily limit is 5 per buddy and resets at the sender's local midnight", async () => {
  const me = await buddyUser({ timezone: 'America/Los_Angeles' });
  const buddy = await buddyUser();
  await pairUp(me.id, buddy.id);
  const lateEvening = new Date('2026-10-07T06:30:00Z'); // Oct 6, 23:30 in LA
  for (let i = 0; i < 5; i++) await sendSticker(me.id, buddy.id, 'CHEER', lateEvening);
  await expect(sendSticker(me.id, buddy.id, 'CHEER', lateEvening)).rejects.toMatchObject({ code: 'sticker_limit' });
  const afterMidnight = new Date('2026-10-07T07:30:00Z'); // Oct 7, 00:30 in LA
  await expect(sendSticker(me.id, buddy.id, 'CHEER', afterMidnight)).resolves.toMatchObject({ id: expect.any(String) });
});
