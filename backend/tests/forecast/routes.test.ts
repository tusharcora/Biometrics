import request from 'supertest';
import { createApp } from '../../src/app';
import { loadForecastData } from '../../src/forecast/load';
import { shiftDate } from '../../src/scoring/dates';
import { rescoreUser } from '../../scripts/rescoreUser';
import { authHeaderFor } from '../helpers/auth';
import { createUser, seedHistory } from '../scoring/dbHelpers';
import { migrateTestDb } from '../setupTestDb';

const NOW = new Date('2026-06-30T12:00:00Z');

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY ??= 'a'.repeat(64);
});

describe('GET /me/forecast', () => {
  it('requires auth', async () => {
    await request(createApp()).get('/me/forecast').expect(401);
  });

  it('returns NOT_ENOUGH_DATA for a new user', async () => {
    const user = await createUser();
    const res = await request(createApp()).get('/me/forecast').set(await authHeaderFor(user.id)).expect(200);
    expect(res.body).toEqual({ status: 'NOT_ENOUGH_DATA', reason: 'NO_HISTORY', daysOfHistory: 0 });
  });

  it('returns READY with a 13-cell grid once 40 days are scored', async () => {
    const user = await createUser();
    const today = new Date().toISOString().slice(0, 10);
    await seedHistory(user.id, shiftDate(today, -39), 40);
    await rescoreUser(user.id, { days: 40 });
    const res = await request(createApp()).get('/me/forecast').set(await authHeaderFor(user.id)).expect(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.date).toBe(shiftDate(today, 1));
    expect(res.body.grid).toHaveLength(13);
    expect(res.body.levers.map((l: { key: string }) => l.key)).toEqual(['SLEEP', 'ALCOHOL', 'CAFFEINE', 'WORKOUT']);
  });
});

describe('loadForecastData', () => {
  // Review Focus 1
  it("uses the user's local date, not the UTC date", async () => {
    const user = await createUser({ timezone: 'Pacific/Kiritimati' }); // UTC+14
    const data = await loadForecastData(user.id, NOW);
    expect(data.today).toBe('2026-07-01');
  });

  it('reads sleep keyed by the local night-end date and the stored Recovery scores', async () => {
    const user = await createUser();
    await seedHistory(user.id, '2026-06-01', 30);
    await rescoreUser(user.id, { days: 30, now: NOW });
    const data = await loadForecastData(user.id, NOW);
    expect(data.sleep.length).toBeGreaterThanOrEqual(28);
    expect(data.sleep.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
    expect(data.scores.size).toBeGreaterThan(0);
    expect(data.habitTypes.map((t) => t.type)).toEqual(['ALCOHOL', 'CAFFEINE', 'WORKOUT']);
  });
});
