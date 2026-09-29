import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { buildForecast } from '../../src/forecast/engine';
import { loadForecastData } from '../../src/forecast/load';
import { parseArgs, seedDemoUser } from '../../scripts/seedDemoUser';
import { migrateTestDb } from '../setupTestDb';

const EMAIL = 'demo-seed@example.com';
const PASSWORD = 'demo-password-123';

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY ??= 'a'.repeat(64);
});

describe('seedDemoUser', () => {
  jest.setTimeout(120_000);

  it('refuses to run in production without --force', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await expect(seedDemoUser({ email: EMAIL, password: PASSWORD })).rejects.toThrow(/production/);
    process.env.NODE_ENV = env;
  });

  it('builds a showcase account the real pipelines turn into a READY forecast', async () => {
    const { userId } = await seedDemoUser({ email: EMAIL, password: PASSWORD, seed: 7 });
    const f = buildForecast(await loadForecastData(userId, new Date()));
    if (f.status !== 'READY') throw new Error(`forecast not ready: ${JSON.stringify(f)}`);

    expect(f.levers.find((l) => l.key === 'ALCOHOL')!.effect).toBe('CONFIRMED');
    expect(f.levers.find((l) => l.key === 'CAFFEINE')!.effect).toBe('NONE_YET');
    expect(f.trackRecord.days).toBeGreaterThanOrEqual(25);
    const at = (exposed: boolean) =>
      f.grid.find((c) => c.sleepHours === 7.5 && c.exposed.includes('ALCOHOL') === exposed && c.exposed.length === (exposed ? 1 : 0))!;
    expect(at(true).score).toBeLessThan(at(false).score);

    // No sync connection, so the worker never touches it.
    expect(await prisma.healthConnection.count({ where: { userId } })).toBe(0);
  });

  it('is idempotent and the account can sign in with email and password', async () => {
    const first = await seedDemoUser({ email: EMAIL, password: PASSWORD, seed: 7 });
    const second = await seedDemoUser({ email: EMAIL, password: PASSWORD, seed: 7 });
    expect(second.userId).not.toBe(first.userId);
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
    await request(createApp())
      .post('/auth/sign-in/email')
      .set({ 'expo-origin': 'biometrics://' })
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('parses CLI args', () => {
    expect(parseArgs(['--email', 'a@b.c'])).toEqual({ email: 'a@b.c', seed: 1, force: false });
    expect(parseArgs(['--email', 'a@b.c', '--seed', '9', '--force'])).toEqual({ email: 'a@b.c', seed: 9, force: true });
    expect(() => parseArgs([])).toThrow(/--email/);
  });
});
