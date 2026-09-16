import { syncQueue, connection, enqueueFetchJob, enqueueBackfillJob } from '../../src/sync/queue';

afterAll(async () => {
  await syncQueue.close();
  await connection.quit();
});

describe('sync queue', () => {
  it('enqueues a fetch job with the expected name and data', async () => {
    const job = await enqueueFetchJob({ userId: 'u1', metricType: 'STEPS', date: '2026-09-01' });
    expect(job.name).toBe('fetch');
    expect(job.data).toEqual({ userId: 'u1', metricType: 'STEPS', date: '2026-09-01' });
  });

  it('enqueues a backfill job with the expected name and data', async () => {
    const job = await enqueueBackfillJob({ userId: 'u1', startDate: '2026-08-01', endDate: '2026-09-01' });
    expect(job.name).toBe('backfill');
    expect(job.data).toEqual({ userId: 'u1', startDate: '2026-08-01', endDate: '2026-09-01' });
  });
});
