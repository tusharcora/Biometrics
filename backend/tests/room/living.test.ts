import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { coinUser } from '../coins/helpers';
import { day, level } from '../cosmetics/helpers';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../../src/biometrics/civilDate';
import { EMPTY_WORN, RELEASE_LAUNCHED_AT } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
import * as livingModule from '../../src/room/living';
import { MAX_AWARDS, petEnergyOf, plantStageFor, plantStageOf, readLiving } from '../../src/room/living';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-24T09:00:00.000Z');
const P3 = RELEASE_LAUNCHED_AT[5];

async function nights(userId: string, n: number) {
  await prisma.coinEvent.createMany({
    data: Array.from({ length: n }, (_, k) => {
      const d = new Date(Date.UTC(2026, 8, 1 + k)).toISOString().slice(0, 10);
      // 0-coin rows count too (spec §8.3): every other night was written at the cap.
      return { userId, kind: 'sleep_goal', sourceKey: `sleep_goal:${d}`, amount: k % 2 ? 0 : 20, capDay: day(d) };
    }),
  });
}
async function steps(userId: string, tz: string, value: number) {
  await prisma.biometricRecord.create({ data: { userId, metricType: 'STEPS', value, recordedAt: civilDateToUtcMidnight(localCivilDateOrUtc(NOW, tz)) } });
}
/** An account made after P3 launched (ruling PF3-PLANTS: its plants start at stage 1). */
async function afterP3(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { createdAt: new Date(P3.getTime() + 60_000) } });
}

describe('the living room (spec §8.3, P3 ruling 6)', () => {
  it('grows a plant a stage every 7 sleep-goal nights, from 1 to 5', () => {
    expect([0, 6, 7, 13, 14, 28, 200].map(plantStageOf)).toEqual([1, 1, 2, 2, 3, 5, 5]);
  });

  it('bands steps against the step goal: under 30% naps, then wanders, and plays at the goal', () => {
    expect([0, 2999, 3000, 9999, 10000, 25000].map(petEnergyOf)).toEqual(['nap', 'nap', 'wander', 'wander', 'play', 'play']);
  });

  it('reads the nights, today\'s steps in the user\'s own zone and the award levels, highest first, at most 8', async () => {
    const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
    await nights(user.id, 15);
    await steps(user.id, 'Pacific/Auckland', 4200);
    const families = ['SLEEP_GOAL', 'STEADY_BEDTIME', 'STEP_GOAL', 'CHECK_IN', 'BEST_RECOVERY_WEEK'] as const;
    for (const [k, family] of families.entries()) {
      await level(user.id, family, 1, NOW);
      await level(user.id, family, 2, NOW);
      if (k < 2) await level(user.id, family, 3, NOW);
    }
    const living = await readLiving(user.id, NOW);
    expect(living).toEqual({ plantStage: 3, petEnergy: 'wander', awards: [3, 3, 2, 2, 2, 2, 2, 1] });
    expect(living.awards).toHaveLength(MAX_AWARDS);
  });

  it('a new user\'s room: stage 1, the cat asleep, no awards', async () => {
    const { user } = await coinUser();
    await afterP3(user.id);
    expect(await readLiving(user.id, NOW)).toEqual({ plantStage: 1, petEnergy: 'nap', awards: [] });
  });

  it('GET /me/cosmetics carries it, and no health value anywhere in the body', async () => {
    const { user, headers } = await coinUser();
    await nights(user.id, 7);
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.living).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [] });
    expect(JSON.stringify(res.body)).not.toMatch(/"(steps|minutes|sleepMinutes|value)"/);
  });
});

describe('plants in a room from before P3 (ruling PF3-PLANTS)', () => {
  it('stay fully grown until 7 counted nights, then follow the count', () => {
    expect([0, 6, 7, 14, 28].map((n) => plantStageFor(n, true))).toEqual([5, 5, 2, 3, 5]);
    expect([0, 6, 7, 14, 28].map((n) => plantStageFor(n, false))).toEqual([1, 1, 2, 3, 5]);
  });

  it('an account made before the P3 launch reads stage 5 with 6 nights, and 2 at the 7th', async () => {
    const { user } = await coinUser();
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: new Date(P3.getTime() - 60_000) } });
    await nights(user.id, 6);
    expect((await readLiving(user.id, NOW)).plantStage).toBe(5);
    await prisma.coinEvent.create({ data: { userId: user.id, kind: 'sleep_goal', sourceKey: 'sleep_goal:2026-10-20', amount: 0, capDay: day('2026-10-20') } });
    expect((await readLiving(user.id, NOW)).plantStage).toBe(2);
  });

  it('an account made after the P3 launch starts at stage 1', async () => {
    const { user } = await coinUser();
    await afterP3(user.id);
    await nights(user.id, 6);
    expect((await readLiving(user.id, NOW)).plantStage).toBe(1);
  });
});

describe('a failed living read (ruling PF3-LIVING)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(livingModule, 'readLiving').mockRejectedValue(new TypeError('boom'));
  });
  afterEach(() => jest.restoreAllMocks());

  const lines = () => warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('room.living_failed'));

  it('GET answers without `living` and logs the error name only', async () => {
    const { user, headers } = await coinUser();
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('living');
    expect(res.body.layout).toEqual(starterLayout());
    expect(lines().map((l) => JSON.parse(l))).toEqual([{ event: 'room.living_failed', error: 'TypeError' }]);
    expect(lines().join('')).not.toContain(user.id);
  });

  it('a save still saves and answers without `living`', async () => {
    const { headers } = await coinUser();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const res = await (await api()).put('/me/cosmetics').set(headers).send({ layout: starterLayout(), worn: { ...EMPTY_WORN }, version: 0 });
    expect([res.status, res.body.version, 'living' in res.body]).toEqual([200, 1, false]);
    expect(lines()).toHaveLength(1);
  });
});

describe('who sees it (spec §8.3, §16)', () => {
  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []);
  }

  it('only the cosmetics body reads it: no buddy, social, chat, coach or KIP module imports room/living', () => {
    const root = path.join(__dirname, '../../src');
    const IMPORT = /(?:from|require\()\s*['"][^'"]*room\/living['"]/;
    const hits = files(root).filter((f) => IMPORT.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    expect(hits).toEqual(['cosmetics/loadout.ts']);
  });

  it('readLiving logs nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const { user } = await coinUser();
    await nights(user.id, 3);
    await readLiving(user.id, NOW);
    expect(spies.flatMap((s) => s.mock.calls)).toEqual([]);
    spies.forEach((s) => s.mockRestore());
  });
});
