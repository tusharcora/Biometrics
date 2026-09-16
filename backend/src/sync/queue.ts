import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { BiometricMetricType } from '../types';

export interface FetchJobData {
  userId: string;
  metricType: BiometricMetricType;
  date: string; // YYYY-MM-DD
}

export interface BackfillJobData {
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const syncQueue = new Queue('fitbit-sync', { connection });

export function enqueueFetchJob(data: FetchJobData) {
  return syncQueue.add('fetch', data);
}

export function enqueueBackfillJob(data: BackfillJobData) {
  return syncQueue.add('backfill', data);
}
