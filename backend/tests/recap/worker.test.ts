import type { Job } from 'bullmq';
import { connection, syncQueue } from '../../src/sync/queue';
import { processSyncJob } from '../../src/sync/worker';
import { RECAP_BUILD_JOB, RECAP_SWEEP_JOB } from '../../src/recap/queue';
import { runRecapSweep } from '../../src/recap/sweep';
import { runRecapJob } from '../../src/recap/build';

jest.mock('../../src/recap/sweep', () => ({ runRecapSweep: jest.fn(async () => ({ usersChecked: 0, jobsEnqueued: 0, failed: 0 })) }));
jest.mock('../../src/recap/build', () => ({ runRecapJob: jest.fn(async () => 'built'), defaultRecapDeps: jest.fn(() => ({ marker: 'deps' })) }));

afterAll(async () => {
  await syncQueue.close();
  await connection.quit();
});

it('dispatches the recap sweep and recap build jobs', async () => {
  await processSyncJob({ name: RECAP_SWEEP_JOB, data: {} } as unknown as Job);
  expect(runRecapSweep).toHaveBeenCalledTimes(1);
  const data = { userId: 'u1', kind: 'WEEK', periodStart: '2026-09-28' };
  await processSyncJob({ name: RECAP_BUILD_JOB, data } as unknown as Job);
  expect(runRecapJob).toHaveBeenCalledWith(data, { marker: 'deps' });
});
