import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { saveCheckIn } from '../../src/social/checkins';
import { markStickersSeen } from '../../src/social/home';
import { api, buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('returns the whole Social home in one call, never cached', async () => {
  const me = await buddyUser({ displayName: 'Me' });
  const sam = await buddyUser();
  const ana = await buddyUser();
  await pairUp(me.id, sam.id);
  await pairUp(me.id, ana.id);
  await saveCheckIn(sam.id, 'RESTED', new Date());
  await prisma.sticker.create({ data: { fromUserId: ana.id, toUserId: me.id, kind: 'STAR' } });
  const res = await (await api()).get('/me/social').set(await authHeaderFor(me.id));
  expect([res.status, res.headers['cache-control']]).toEqual([200, 'private, no-store']);
  expect(Object.keys(res.body).sort()).toEqual(['camp', 'highlights', 'me', 'stories', 'timeline', 'unread']);
  expect(res.body.me).toEqual({ person: expect.objectContaining({ id: me.id, displayName: 'Me' }), checkIn: null });
  expect(res.body.camp).toEqual({ checkedIn: 1, members: 3, faces: [res.body.stories[0].author.coachId] });
  expect(res.body.stories.map((r: { author: { id: string }; locked: boolean }) => [r.author.id, r.locked])).toEqual([[sam.id, true]]);
  expect(res.body.unread).toEqual({ requests: 0, stickers: 1 });
  expect(res.body.timeline.map((i: { kind: string }) => i.kind)).toEqual(['checkin', 'sticker']);
  // I haven't checked in: Sam's check-in is in the timeline, locked, with no mood on the wire.
  expect(res.body.timeline[0]).toMatchObject({ kind: 'checkin', locked: true, actor: { id: sam.id } });
  expect(res.body.timeline[0]).not.toHaveProperty('mood');
});

it('marks unseen stickers from current buddies seen, so the unread count drops', async () => {
  const me = await buddyUser();
  const ana = await buddyUser();
  const stranger = await buddyUser();
  await pairUp(me.id, ana.id);
  await prisma.sticker.create({ data: { fromUserId: ana.id, toUserId: me.id, kind: 'STAR' } });
  await prisma.sticker.create({ data: { fromUserId: ana.id, toUserId: me.id, kind: 'CHEER' } });
  await prisma.sticker.create({ data: { fromUserId: stranger.id, toUserId: me.id, kind: 'HEART' } }); // not a buddy: untouched
  expect(await markStickersSeen(me.id, new Date())).toBe(2);
  expect(await prisma.sticker.count({ where: { toUserId: me.id, seenAt: null } })).toBe(1);

  await prisma.sticker.create({ data: { fromUserId: ana.id, toUserId: me.id, kind: 'REST_UP' } });
  const agent = await api();
  const headers = await authHeaderFor(me.id);
  expect((await agent.get('/me/social').set(headers)).body.unread).toEqual({ requests: 0, stickers: 1 });
  const seen = await agent.post('/me/social/stickers/seen').set(headers);
  expect(seen.status).toBe(204);
  expect((await agent.get('/me/social').set(headers)).body.unread).toEqual({ requests: 0, stickers: 0 });
  expect((await agent.post('/me/social/stickers/seen')).status).toBe(401);
});

it('works for someone with no buddies yet', async () => {
  const me = await buddyUser();
  const res = await (await api()).get('/me/social').set(await authHeaderFor(me.id));
  expect(res.body).toMatchObject({ camp: { checkedIn: 0, members: 1, faces: [] }, stories: [], timeline: [], highlights: null, unread: { requests: 0, stickers: 0 } });
});
