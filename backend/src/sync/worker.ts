import { Job, Worker } from 'bullmq';
import { prisma } from '../db/client';
import { connection, TOKEN_REFRESH_SWEEP_JOB } from './queue';
import { runTokenRefreshSweep } from './tokenRefreshJob';
import { fetchMetricRange } from '../health/client';
import { deleteUserSubscription } from '../health/subscriber';
import { decryptToken } from '../crypto/tokenCipher';
import { upsertBiometricRecords } from '../biometrics/repository';
import { BiometricMetricType } from '../types';
import { FetchJobData, BackfillJobData } from './queue';

const ALL_METRIC_TYPES: BiometricMetricType[] = ['HRV', 'RESTING_HR', 'SLEEP', 'STEPS'];
const SYNC_WORKER_CONCURRENCY = 5;

async function disconnect(userId: string, webhookSubscriptionId: string | null): Promise<void> {
  await prisma.healthConnection.update({
    where: { userId },
    data: { status: 'DISCONNECTED' },
  });
  if (webhookSubscriptionId) {
    try {
      await deleteUserSubscription(webhookSubscriptionId);
    } catch (err) {
      console.error(`Failed to delete Google Health subscription ${webhookSubscriptionId}`, err);
    }
  }
}

async function handleFetchJob(data: FetchJobData): Promise<void> {
  const conn = await prisma.healthConnection.findUnique({ where: { userId: data.userId } });
  if (!conn || conn.status === 'DISCONNECTED') return;

  try {
    const accessToken = decryptToken(conn.encryptedAccessToken);
    const points = await fetchMetricRange(accessToken, data.metricType, data.date, data.date);
    await upsertBiometricRecords(data.userId, data.metricType, points);
    await prisma.healthConnection.update({
      where: { userId: data.userId },
      data: { lastSyncedAt: new Date() },
    });
  } catch (err) {
    if ((err as any).status === 401) {
      await disconnect(data.userId, conn.webhookSubscriptionId);
      return;
    }
    throw err; // other errors (e.g. 429) are retried by BullMQ's job retry policy
  }
}

async function handleBackfillJob(data: BackfillJobData): Promise<void> {
  const conn = await prisma.healthConnection.findUnique({ where: { userId: data.userId } });
  if (!conn || conn.status === 'DISCONNECTED') return;

  try {
    const accessToken = decryptToken(conn.encryptedAccessToken);
    for (const metricType of ALL_METRIC_TYPES) {
      const points = await fetchMetricRange(accessToken, metricType, data.startDate, data.endDate);
      await upsertBiometricRecords(data.userId, metricType, points);
    }
    await prisma.healthConnection.update({ where: { userId: data.userId }, data: { lastSyncedAt: new Date() } });
  } catch (err) {
    if ((err as any).status === 401) {
      await disconnect(data.userId, conn.webhookSubscriptionId);
      return;
    }
    throw err; // other errors (e.g. 429) are retried by BullMQ's job retry policy
  }
}

export async function processSyncJob(job: Job): Promise<void> {
  if (job.name === 'fetch') {
    await handleFetchJob(job.data as FetchJobData);
  } else if (job.name === 'backfill') {
    await handleBackfillJob(job.data as BackfillJobData);
  } else if (job.name === TOKEN_REFRESH_SWEEP_JOB) {
    // Scheduled through the queue so exactly one instance sweeps per tick.
    await runTokenRefreshSweep();
  }
}

export function startSyncWorker(): Worker {
  return new Worker('health-sync', processSyncJob, {
    connection,
    concurrency: SYNC_WORKER_CONCURRENCY,
  });
}
