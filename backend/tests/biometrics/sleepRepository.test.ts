import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import {
  upsertSleepSessions,
  recomputeSleepRollups,
  recomputeAllSleepRollups,
  storeSleepSessions,
  datesNeedingRescore,
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

  // Two sync jobs for the same user used to read their own snapshot of the
  // sessions, each compute a total from it, and both write -- so whichever
  // committed last could persist a rollup that omitted the other's session.
  it('two concurrent stores for the same night leave the rollup equal to the sum', async () => {
    const user = await createUser();

    await Promise.all([
      storeSleepSessions(user.id, [mainSleep]),
      storeSleepSessions(user.id, [nap]),
    ]);

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

// Change 3: the day key comes from each record's own UTC offset, not from
// User.timezone (which is wrong the moment the user travels).
describe("sleep rollups keyed by the record's own UTC offset", () => {
  function withOffsets(start: string, end: string, minutesAsleep: number, startOffset: number | null, endOffset: number | null): SleepSessionPoint {
    return { ...session(start, end, minutesAsleep), startUtcOffsetSeconds: startOffset, endUtcOffsetSeconds: endOffset };
  }

  it('stores both offsets on the row', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [withOffsets('2026-09-01T22:00:00Z', '2026-09-02T06:00:00Z', 420, -14400, 3600)]);
    const [row] = await prisma.sleepSession.findMany({ where: { userId: user.id } });
    expect(row!.startUtcOffsetSeconds).toBe(-14400);
    expect(row!.endUtcOffsetSeconds).toBe(3600);
  });

  it('stores null offsets when the point carries none (or null)', async () => {
    const user = await createUser();
    await upsertSleepSessions(user.id, [mainSleep, withOffsets('2026-09-02T22:00:00Z', '2026-09-03T06:00:00Z', 400, null, null)]);
    const rows = await prisma.sleepSession.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.startUtcOffsetSeconds).toBeNull();
      expect(r.endUtcOffsetSeconds).toBeNull();
    }
  });

  it("the offset overrides the user timezone: a New York user's +09:00 (Tokyo) night lands on the Tokyo date", async () => {
    const user = await createUser('America/New_York');
    // Ends 22:00Z Sep 2: 18:00 Sep 2 in New York, but 07:00 Sep 3 at +09:00.
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, 32400, 32400)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 440 }]);
  });

  it('a null offset falls back to the user timezone', async () => {
    const user = await createUser('America/New_York');
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, null, null)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 440 }]);
  });

  it('negative offset: 02:00Z at -04:00 is 22:00 the previous local day, whatever the user zone says', async () => {
    const user = await createUser('Asia/Tokyo');
    await storeSleepSessions(user.id, [withOffsets('2026-09-01T18:00:00Z', '2026-09-02T02:00:00Z', 460, -14400, -14400)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-01', value: 460 }]);
  });

  it('zero offset is UTC, not "missing"', async () => {
    const user = await createUser('Asia/Tokyo');
    // Tokyo would say Sep 3 (08:30); the record says +00:00, so Sep 2.
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T15:00:00Z', '2026-09-02T23:30:00Z', 450, 0, 0)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 450 }]);
  });

  it('half-hour offset: +05:30 is local midnight at 18:30Z', async () => {
    const user = await createUser('UTC');
    await storeSleepSessions(user.id, [
      withOffsets('2026-09-02T10:00:00Z', '2026-09-02T18:29:00Z', 400, 19800, 19800), // 23:59 local Sep 2
      withOffsets('2026-09-03T10:00:00Z', '2026-09-03T18:31:00Z', 300, 19800, 19800), // 00:01 local Sep 4
    ]);
    expect(await rollups(user.id)).toEqual([
      { date: '2026-09-02', value: 400 },
      { date: '2026-09-04', value: 300 },
    ]);
  });

  it('a night that crosses local midnight is keyed by the END date (start 23:00 local Sep 2, end 07:00 local Sep 3)', async () => {
    const user = await createUser('America/Los_Angeles');
    // +09:00: start 14:00Z = 23:00 Sep 2, end 22:00Z = 07:00 Sep 3.
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 470, 32400, 32400)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 470 }]);
  });

  it('sums sessions from different offsets that land on the same local date', async () => {
    const user = await createUser('UTC');
    await storeSleepSessions(user.id, [
      withOffsets('2026-09-01T22:00:00Z', '2026-09-02T06:00:00Z', 420, 0, 0), // Sep 2
      withOffsets('2026-09-02T00:30:00Z', '2026-09-02T02:00:00Z', 60, 32400, 32400), // 11:00 Sep 2 at +09:00
      withOffsets('2026-09-02T18:00:00Z', '2026-09-03T02:00:00Z', 300, -18000, -18000), // 21:00 Sep 2 at -05:00
    ]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 780 }]);
  });

  it('re-upsert is idempotent and FILLS previously-null offsets, moving the rollup to the offset-derived date', async () => {
    const user = await createUser('America/New_York');
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, null, null)]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-02', value: 440 }]); // New York fallback

    const filled = withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, 32400, 32400);
    const touchedDates = await storeSleepSessions(user.id, [filled]);
    // Both the date it left and the date it arrived on are reported for rescoring.
    expect(touchedDates).toEqual(['2026-09-02', '2026-09-03']);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 440 }]);
    const rows = await prisma.sleepSession.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.startUtcOffsetSeconds).toBe(32400);
    expect(rows[0]!.endUtcOffsetSeconds).toBe(32400);

    // A third identical fetch changes nothing.
    await storeSleepSessions(user.id, [filled]);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 440 }]);
    expect(await prisma.sleepSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it('a revised end offset reports the date under its PREVIOUS offset too', async () => {
    const user = await createUser('UTC');
    await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, -14400, -14400)]); // 18:00 Sep 2
    const dates = await storeSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, 32400, 32400)]); // 07:00 Sep 3
    expect(dates).toEqual(['2026-09-02', '2026-09-03']);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 440 }]);
  });

  it('recomputeAllSleepRollups: a timezone change moves null-offset sessions but not sessions that carry an offset', async () => {
    const user = await createUser('UTC');
    await storeSleepSessions(user.id, [
      // Ends 05:30Z Sep 3: UTC Sep 3, Los Angeles Sep 2. No offset -> follows the zone.
      withOffsets('2026-09-02T20:00:00Z', '2026-09-03T05:30:00Z', 500, null, null),
      // Ends 22:00Z Sep 5 at +09:00 = Sep 6. Offset -> ignores the zone.
      withOffsets('2026-09-05T14:00:00Z', '2026-09-05T22:00:00Z', 430, 32400, 32400),
    ]);
    expect(await rollups(user.id)).toEqual([
      { date: '2026-09-03', value: 500 },
      { date: '2026-09-06', value: 430 },
    ]);

    await prisma.user.update({ where: { id: user.id }, data: { timezone: 'America/Los_Angeles' } });
    await recomputeAllSleepRollups(user.id);
    expect(await rollups(user.id)).toEqual([
      { date: '2026-09-02', value: 500 },
      { date: '2026-09-06', value: 430 },
    ]);
  });

  it('recomputeSleepRollups uses the stored offsets when asked for a date', async () => {
    const user = await createUser('America/New_York');
    await upsertSleepSessions(user.id, [withOffsets('2026-09-02T14:00:00Z', '2026-09-02T22:00:00Z', 440, 32400, 32400)]);
    await recomputeSleepRollups(user.id, ['2026-09-02', '2026-09-03']);
    expect(await rollups(user.id)).toEqual([{ date: '2026-09-03', value: 440 }]);
  });
});

describe('datesNeedingRescore', () => {
  // A night is an input to its own day AND to every later day whose sleep-debt
  // window still contains it. Returning only the touched day left the next two
  // weeks scored against a window that no longer matched the data -- and the
  // nightly sweep cannot catch it, because those days' own inputs never moved.
  it('covers the whole sleep-debt window forward from each changed night', () => {
    const out = datesNeedingRescore(['2026-09-02'], '2026-12-31');

    expect(out[0]).toBe('2026-09-02');
    expect(out).toHaveLength(14);
    expect(out[13]).toBe('2026-09-15');
  });

  it('never asks for a day that has not happened yet', () => {
    const out = datesNeedingRescore(['2026-09-02'], '2026-09-04');
    expect(out).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
  });

  it('merges overlapping windows instead of repeating days', () => {
    const out = datesNeedingRescore(['2026-09-02', '2026-09-03'], '2026-12-31');
    expect(new Set(out).size).toBe(out.length);
    expect(out).toHaveLength(15);
  });

  it('returns nothing for no changed nights', () => {
    expect(datesNeedingRescore([], '2026-12-31')).toEqual([]);
  });
});
