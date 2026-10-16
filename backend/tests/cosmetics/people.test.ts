import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { kipWornOf } from '../../src/cosmetics/worn';
import { starterLayout } from '../../src/room/convert';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { level } from './helpers';

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
  const layout = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'rug' ? { ...p, item: 'rug.red' } : p)) };
  await prisma.cosmeticLoadout.create({ data: { userId: sam.id, layout: layout as unknown as Prisma.InputJsonValue, worn: { ...EMPTY_WORN, head: 'out.cap' }, version: 1 } });
  // Sam's room has a living state to leak: 7 sleep-goal nights and a badge level.
  await prisma.coinEvent.createMany({ data: Array.from({ length: 7 }, (_, k) => ({ userId: sam.id, kind: 'sleep_goal' as const, sourceKey: `sleep_goal:2026-09-0${k + 1}`, amount: 20, capDay: civilDateToUtcMidnight(`2026-09-0${k + 1}`) })) });
  await level(sam.id, 'SLEEP_GOAL', 1, new Date());
  const res = await (await api()).get('/me/buddies').set(await authHeaderFor(me.id));
  const row = res.body.buddies.find((b: { id: string }) => b.id === sam.id);
  expect(row.kipWorn).toEqual({ head: 'out.cap', face: null, neck: null, ears: null });
  expect(JSON.stringify(res.body)).not.toContain('rug.red');
  expect(JSON.stringify(res.body)).not.toMatch(/"(owned|room|fresh|counters)"/);
  // P3: the living room is never shown to buddies (spec §8.3, §10.1).
  expect(JSON.stringify(res.body)).not.toMatch(/"(living|plantStage|petEnergy|awards)"/);
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
