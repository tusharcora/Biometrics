import { Job, Worker } from 'bullmq';
import type { HealthConnection } from '@prisma/client';
import { prisma } from '../db/client';
import { connection, TOKEN_REFRESH_SWEEP_JOB } from './queue';
import { runTokenRefreshSweep } from './tokenRefreshJob';
import { fetchMetricRange } from '../health/client';
import { refreshHealthTokens } from '../health/oauth';
import { deleteUserSubscription } from '../health/subscriber';
import { decryptToken } from '../crypto/tokenCipher';
import { upsertBiometricRecords } from '../biometrics/repository';
import { BiometricMetricType, HealthMetricPoint } from '../types';
import { FetchJobData, BackfillJobData } from './queue';
import { refreshedTokenUpdateData } from './tokenUpdate';

const ALL_METRIC_TYPES: BiometricMetricType[] = ['HRV', 'RESTING_HR', 'SLEEP', 'STEPS'];
const SYNC_WORKER_CONCURRENCY = 5;

function isUnauthorized(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 401;
}

// YYYY-MM-DD -> the following calendar day, also YYYY-MM-DD (UTC arithmetic,
// so month/year rollovers are handled by Date).
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid job date "${isoDate}": expected YYYY-MM-DD`);
  }
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

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

/**
 * Per-job access-token state. A 401 from Google can mean the grant was
 * revoked, but it can equally mean the access token merely expired between
 * the last refresh sweep and this job running (sweep lag, clock skew, a job
 * that sat in the queue). Tearing down the connection and its Google
 * subscription on the first 401 would destroy real state for a transient
 * condition, so each job gets exactly ONE in-line refresh attempt before a
 * 401 is treated as terminal.
 */
class JobTokenSession {
  accessToken: string;
  private refreshed = false;

  constructor(private readonly conn: HealthConnection) {
    this.accessToken = decryptToken(conn.encryptedAccessToken);
  }

  async fetch(metricType: BiometricMetricType, startDate: string, endDate: string): Promise<HealthMetricPoint[]> {
    try {
      return await fetchMetricRange(this.accessToken, metricType, startDate, endDate);
    } catch (err) {
      if (!isUnauthorized(err) || this.refreshed) throw err;

      // One refresh per job. If the refresh itself fails, surface the ORIGINAL
      // 401 so the caller's disconnect path runs exactly as before.
      this.refreshed = true;
      let tokens;
      try {
        tokens = await refreshHealthTokens(decryptToken(this.conn.encryptedRefreshToken));
      } catch (refreshErr) {
        console.error(`In-line Google Health token refresh failed for user ${this.conn.userId}`, refreshErr);
        throw err;
      }

      // Persist before retrying so a successful refresh is never lost even if
      // the retry fails for an unrelated reason. A DB failure here is a
      // transient infrastructure problem, not a revoked grant: it propagates
      // as a non-401 error and BullMQ retries the job.
      await prisma.healthConnection.update({
        where: { id: this.conn.id },
        data: refreshedTokenUpdateData(tokens),
      });
      this.accessToken = tokens.accessToken;

      // A second 401 with a freshly minted token means access really is gone;
      // let it propagate to the disconnect path.
      return await fetchMetricRange(this.accessToken, metricType, startDate, endDate);
    }
  }
}

async function handleFetchJob(data: FetchJobData): Promise<void> {
  const conn = await prisma.healthConnection.findUnique({ where: { userId: data.userId } });
  if (!conn || conn.status === 'DISCONNECTED') return;

  try {
    const session = new JobTokenSession(conn);
    // fetchMetricRange's ranges are half-open (start inclusive, end exclusive):
    // dataPoints.list filters on `>= start AND < end`, and dailyRollUp's
    // confirmed-live usage retrieves the `start` bucket with end = start + 1.
    // Passing the same date for both bounds is an empty range, so a
    // single-day job must ask for [date, date + 1).
    const points = await session.fetch(data.metricType, data.date, nextDay(data.date));
    await upsertBiometricRecords(data.userId, data.metricType, points);
    await prisma.healthConnection.update({
      where: { userId: data.userId },
      data: { lastSyncedAt: new Date() },
    });
  } catch (err) {
    if (isUnauthorized(err)) {
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
    const session = new JobTokenSession(conn);
    for (const metricType of ALL_METRIC_TYPES) {
      const points = await session.fetch(metricType, data.startDate, data.endDate);
      await upsertBiometricRecords(data.userId, metricType, points);
    }
    await prisma.healthConnection.update({ where: { userId: data.userId }, data: { lastSyncedAt: new Date() } });
  } catch (err) {
    if (isUnauthorized(err)) {
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
