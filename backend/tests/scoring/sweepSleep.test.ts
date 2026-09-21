import { runScoreSweep } from '../../src/scoring/sweep';
import { computeDailyScore } from '../../src/scoring/compute';
import { COMPUTE_DAILY_SCORE_JOB, ScoreQueue } from '../../src/scoring/queue';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { createUser, seedHistory, seedSessions, day } from './dbHelpers';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// The test DB is shared with other suites' users, so every assertion filters
// to the user under test.
interface Enqueued {
  userId: string;
  date: string;
  opts: any;
}

function fakeQueue(onAdd?: (e: Enqueued) => Promise<void>): { queue: ScoreQueue; added: Enqueued[] } {
  const added: Enqueued[] = [];
  const queue: ScoreQueue = {
    add: (async (name: string, data: any, opts: any) => {
      expect(name).toBe(COMPUTE_DAILY_SCORE_JOB);
      const e = { userId: data.userId, date: data.date, opts };
      added.push(e);
      await onAdd?.(e);
    }) as ScoreQueue['add'],
  };
  return { queue, added };
}

const NOW = new Date('2026-08-10T12:00:00Z');

describe('nightly score sweep: both score types (Slice 1.5)', () => {
  it('back-fills a day that has a RECOVERY score but no SLEEP score, then stops once the job has run', async () => {
    const user = await createUser();
    await seedHistory(user.id, '2026-08-03', 2);
    // A Recovery row newer than every input, but no Sleep Score.
    for (const d of ['2026-08-03', '2026-08-04']) {
      await prisma.dailyScore.create({
        data: { userId: user.id, date: day(d), type: 'RECOVERY', algorithmVersion: 'v1', score: 50, confidenceLevel: 'LOW', factors: [] },
      });
    }
    const first = fakeQueue();
    await runScoreSweep({ queue: first.queue, now: NOW });
    expect(first.added.filter((a) => a.userId === user.id).map((a) => a.date).sort()).toEqual(['2026-08-03', '2026-08-04']);

    // Once the job has run (both rows written), nothing is stale.
    for (const d of ['2026-08-03', '2026-08-04']) await computeDailyScore(user.id, d);
    const second = fakeQueue();
    await runScoreSweep({ queue: second.queue, now: NOW });
    expect(second.added.filter((a) => a.userId === user.id)).toEqual([]);
  });

  it('recomputes a day whose SLEEP rollup is newer than its Sleep Score', async () => {
    const user = await createUser();
    await seedHistory(user.id, '2026-08-03', 2);
    for (const d of ['2026-08-03', '2026-08-04']) await computeDailyScore(user.id, d);

    await prisma.biometricRecord.update({
      where: { userId_metricType_recordedAt: { userId: user.id, metricType: 'SLEEP', recordedAt: day('2026-08-04') } },
      data: { value: 400, syncedAt: new Date(Date.now() + 60_000) },
    });
    const { queue, added } = fakeQueue();

    await runScoreSweep({ queue, now: NOW });

    expect(added.filter((a) => a.userId === user.id).map((a) => a.date)).toEqual(['2026-08-04']);
  });

  it('does not re-enqueue a day forever for lacking a Sleep Score when it never had sleep', async () => {
    const user = await createUser();
    await prisma.biometricRecord.create({
      data: { userId: user.id, metricType: 'HRV', value: 50, recordedAt: day('2026-08-05') },
    });
    await computeDailyScore(user.id, '2026-08-05');
    expect(await prisma.dailyScore.count({ where: { userId: user.id, type: 'RECOVERY' } })).toBe(1);
    expect(await prisma.dailyScore.count({ where: { userId: user.id, type: 'SLEEP' } })).toBe(0);
    const { queue, added } = fakeQueue();

    await runScoreSweep({ queue, now: NOW });

    expect(added.filter((a) => a.userId === user.id)).toEqual([]);
  });

  it('end to end: running the enqueued jobs back-fills both scores for every day, and a second sweep is a no-op', async () => {
    const user = await createUser();
    await seedHistory(user.id, '2026-06-20', 45); // through 2026-08-03
    await seedSessions(user.id, '2026-06-20', 45);
    const inline = fakeQueue(async (e) => {
      if (e.userId === user.id) await computeDailyScore(e.userId, e.date);
    });

    await runScoreSweep({ queue: inline.queue, now: NOW });
    expect(await prisma.dailyScore.count({ where: { userId: user.id, type: 'RECOVERY' } })).toBe(45);
    expect(await prisma.dailyScore.count({ where: { userId: user.id, type: 'SLEEP' } })).toBe(45);

    const again = fakeQueue();
    await runScoreSweep({ queue: again.queue, now: NOW });
    expect(again.added.filter((a) => a.userId === user.id)).toEqual([]);
  });
});
