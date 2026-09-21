import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import {
  upsertSleepSessions,
  recomputeSleepRollups,
  recomputeAllSleepRollups,
  storeSleepSessions,
  upsertBiometricRecords,
} from '../../src/biometrics/repository';
import { SleepSessionPoint } from '../../src/types';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser(timezone = 'UTC') {
  return prisma.user.create({
    data: { email: `sleep-${randomUUID()}@example.com`, authProvider: 'GOOGLE', providerUserId: randomUUID(), timezone },
  });
}

function session(start: string, end: string, minutesAsleep: number): SleepSessionPoint {
  return { startTime: new Date(start), endTime: new Date(end), minutesAsleep };
}

async function rollups(userId: string) {
  const rows = await prisma.biometricRecord.findMany({
    where: { userId, metricType: 'SLEEP' },
    orderBy: { recordedAt: 'asc' },
  });
  return rows.map((r) => ({ date: r.recordedAt.toISOString().slice(0, 10), value: r.value }));
}

const mainSleep = session('2026-09-01T22:00:00Z', '2026-09-02T06:00:00Z', 420);
const nap = session('2026-09-02T13:00:00Z', '2026-09-02T14:00:00Z', 50);

describe('upsertSleepSessions', () => {
  it('is idempotent: the same session upserted twice leaves exactly one unchanged row', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [mainSleep]);
    await upsertSleepSessions(user.id, [mainSleep]);

    const rows = await prisma.sleepSession.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.minutesAsleep).toBe(420);
    expect(rows[0]!.endTime).toEqual(mainSleep.endTime);
  });

  it('overwrites on a (userId, startTime) match so a revised session converges to the latest values', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [mainSleep]);
    await upsertSleepSessions(user.id, [{ ...mainSleep, minutesAsleep: 435 }]);

    const rows = await prisma.sleepSession.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.minutesAsleep).toBe(435);
  });

  it('reports the end instants it touched, including the previous end of a revised session', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [mainSleep]);
    const revisedEnd = new Date('2026-09-02T09:00:00Z');
    const touched = await upsertSleepSessions(user.id, [{ ...mainSleep, endTime: revisedEnd }]);

    const times = touched.map((d) => d.toISOString()).sort();
    expect(times).toEqual([mainSleep.endTime.toISOString(), revisedEnd.toISOString()].sort());
  });

  it('keeps sessions per user: the same startTime for two users is two rows', async () => {
    const a = await createUser();
    const b = await createUser();
    await upsertSleepSessions(a.id, [mainSleep]);
    await upsertSleepSessions(b.id, [mainSleep]);
    expect(await prisma.sleepSession.count({ where: { userId: { in: [a.id, b.id] } } })).toBe(2);
  });
});

describe('recomputeSleepRollups', () => {
  it('writes a nap plus a main sleep on one local day as one rollup equal to the sum, unchanged on re-sync', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [mainSleep, nap]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 470 }]);

    // Re-syncing either session, alone or together, must not move the total.
    await storeSleepSessions(user.id, [nap]);
    await storeSleepSessions(user.id, [mainSleep]);
    await storeSleepSessions(user.id, [mainSleep, nap]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 470 }]);
    expect(await prisma.sleepSession.count({ where: { userId: user.id } })).toBe(2);
  });

  it('never lowers a total when a window returns only some of a day\'s sessions, and a later window raises it', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [mainSleep, nap]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 470 }]);

    // A partial window sees only the nap: the total is derived from the full
    // stored set, so it stays 470 rather than collapsing to 50.
    await storeSleepSessions(user.id, [nap]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 470 }]);
  });

  it('raises the total once a later window includes a previously missing session', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [nap]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 50 }]);

    await storeSleepSessions(user.id, [mainSleep]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 470 }]);
  });

  it('west of UTC: a session ending before local midnight but after UTC midnight lands on the local date', async () => {
    // Ends 05:30Z Sep 3 == 22:30 Sep 2 in Los Angeles (UTC-7).
    const user = await createUser('America/Los_Angeles');
    await storeSleepSessions(user.id, [session('2026-09-02T20:00:00Z', '2026-09-03T05:30:00Z', 500)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 500 }]);
  });

  it('east of UTC: a session ending before UTC midnight but after local midnight lands on the local date', async () => {
    // Ends 12:30Z Sep 2 == 00:30 Sep 3 in Auckland (UTC+12).
    const user = await createUser('Pacific/Auckland');
    await storeSleepSessions(user.id, [session('2026-09-02T04:00:00Z', '2026-09-02T12:30:00Z', 450)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 450 }]);
  });

  it('keys by the END instant, not the start', async () => {
    // Starts Sep 1 22:00Z, ends Sep 2 06:00Z (UTC user): belongs to Sep 2.
    const user = await createUser();
    await storeSleepSessions(user.id, [mainSleep]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 420 }]);
  });

  it('only recomputes the requested dates', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [mainSleep, session('2026-09-03T22:00:00Z', '2026-09-04T06:00:00Z', 400)]);
    await recomputeSleepRollups(user.id, ['2026-09-02']);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 420 }]);
  });

  it('removes a rollup whose sessions have all moved to another date', async () => {
    const user = await createUser();
    await storeSleepSessions(user.id, [mainSleep]);
    // Google revises the same session (same startTime) to end a day later.
    await storeSleepSessions(user.id, [{ ...mainSleep, endTime: new Date('2026-09-03T06:00:00Z') }]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 420 }]);
  });

  it('does not touch other metrics rows on the same date', async () => {
    const user = await createUser();
    await upsertBiometricRecords(user.id, 'STEPS', [{ recordedAt: new Date('2026-09-02T00:00:00Z'), value: 9000 }]);
    await storeSleepSessions(user.id, [mainSleep]);
    const steps = await prisma.biometricRecord.findMany({ where: { userId: user.id, metricType: 'STEPS' } });
    expect(steps).toHaveLength(1);
    expect(steps[0]!.value).toBe(9000);
  });
});

describe('recomputeAllSleepRollups', () => {
  it('re-derives every rollup under a new timezone and drops those keyed under the old one', async () => {
    const user = await createUser('UTC');
    // Ends 05:30Z Sep 3: UTC date Sep 3, Los Angeles date Sep 2.
    await storeSleepSessions(user.id, [session('2026-09-02T20:00:00Z', '2026-09-03T05:30:00Z', 500)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 500 }]);

    await prisma.user.update({ where: { id: user.id }, data: { timezone: 'America/Los_Angeles' } });
    await recomputeAllSleepRollups(user.id);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 500 }]);
  });

  it('is idempotent', async () => {
    const user = await createUser('Asia/Kolkata');
    await storeSleepSessions(user.id, [mainSleep, nap]);
    const before = await rollups(user.id);
    await recomputeAllSleepRollups(user.id);
    await recomputeAllSleepRollups(user.id);
    expect(await rollups(user.id)).toEqual(before);
  });
});

describe('other metrics keep overwrite-on-conflict', () => {
  it('upsertBiometricRecords still overwrites the value for a repeated (user, metric, day)', async () => {
    const user = await createUser();
    const day = new Date('2026-09-02T00:00:00Z');
    await upsertBiometricRecords(user.id, 'STEPS', [{ recordedAt: day, value: 1000 }]);
    await upsertBiometricRecords(user.id, 'STEPS', [{ recordedAt: day, value: 2500 }]);
    const rows = await prisma.biometricRecord.findMany({ where: { userId: user.id, metricType: 'STEPS' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(2500);
  });
});
