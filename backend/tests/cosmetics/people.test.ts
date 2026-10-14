import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { kipWornOf } from '../../src/cosmetics/worn';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('kipWornOf keeps shipped ids in their own slot and drops everything else', () => {
  expect(kipWornOf({ head: 'out.cap', face: 'out.unknown', neck: 'out.scarf', ears: 'out.beanie' })).toEqual({ head: 'out.cap', face: null, neck: 'out.scarf', ears: null });
  expect(kipWornOf({ head: 'out.crown' })).toEqual({ ...EMPTY_WORN }); // release 2: the app cannot draw it yet
  expect(kipWornOf(null)).toEqual({ ...EMPTY_WORN });
  expect(kipWornOf(['out.cap'])).toEqual({ ...EMPTY_WORN });
});

it('a buddy row carries what their KIP wears, and nothing about their room', async () => {
  const me = await buddyUser();
  const sam = await buddyUser();
  await pairUp(me.id, sam.id);
  await prisma.cosmeticLoadout.create({ data: { userId: sam.id, room: { ...STARTER_ROOM, rug: 'rug.red' }, worn: { ...EMPTY_WORN, head: 'out.cap' }, version: 1 } });
  const res = await (await api()).get('/me/buddies').set(await authHeaderFor(me.id));
  const row = res.body.buddies.find((b: { id: string }) => b.id === sam.id);
  expect(row.kipWorn).toEqual({ head: 'out.cap', face: null, neck: null, ears: null });
  expect(JSON.stringify(res.body)).not.toContain('rug.red');
  expect(JSON.stringify(res.body)).not.toMatch(/"(owned|room|fresh|counters)"/);
});

it('someone with no saved loadout wears nothing', async () => {
  const me = await buddyUser();
  const sam = await buddyUser();
  await pairUp(me.id, sam.id);
  const res = await (await api()).get('/me/buddies').set(await authHeaderFor(me.id));
  expect(res.body.buddies.find((b: { id: string }) => b.id === sam.id).kipWorn).toEqual({ ...EMPTY_WORN });
});

it('the handle lookup (your own identity) has no worn field', async () => {
  const me = await buddyUser();
  const res = await (await api()).get('/me/buddies/me').set(await authHeaderFor(me.id));
  expect(res.body).not.toHaveProperty('kipWorn');
});
