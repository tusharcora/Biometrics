// backend/src/coach/daySummaryJob.ts
// Writes the Coach page's day summary right after a sync scores today (spec
// 2026-09-30 section 4), as its own job on the 'health-sync' queue so a slow
// model never holds up the score job. Dispatched in sync/worker.ts, like the
// other coach jobs. Kept out of answer/today.ts because importing the queue
// opens a Redis connection, which the HTTP routes do not need.

import type { Queue } from 'bullmq';
import { localCivilDate } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { syncQueue } from '../sync/queue';
import { generateTodaySummary, summaryEngineDeps, SummaryOutcome, TodayDeps } from './answer/today';
import { systemClock } from './clock';
import { getCoachProvider, getHostedProvider, isCoachEnabled } from './config';
import { hasCurrentConsent } from './consent';
import { LoggerCoachTelemetry } from './telemetry';

export const COACH_DAY_SUMMARY_JOB = 'coachDaySummary';

export interface DaySummaryJobData {
  userId: string;
  date: string; // YYYY-MM-DD, the user's local day that was scored
}

export type DaySummaryQueue = Pick<Queue, 'add'>;

/** One queued summary per user and day: a burst of rescoring collapses into one model call. */
export function daySummaryJobId(userId: string, date: string): string {
  return `coach-summary-${userId}-${date}`;
}

function safeCivilDate(now: Date, timezone: string): string {
  try {
    return localCivilDate(now, timezone);
  } catch {
    return localCivilDate(now, 'UTC');
  }
}

/**
 * Called by the worker after computeDailyScore scored a day. Queues a summary
 * only for the user's local TODAY (not a backfilled or swept past day), only
 * while the coach is on and the user has the coach consent. Never throws: the
 * score is already stored, and the page falls back to the template anyway.
 */
export async function refreshDaySummaryAfterScore(
  userId: string,
  date: string,
  { queue = syncQueue, now = () => new Date() }: { queue?: DaySummaryQueue; now?: () => Date } = {},
): Promise<boolean> {
  try {
    if (!isCoachEnabled()) return false;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    if (!user || safeCivilDate(now(), user.timezone) !== date) return false;
    if (!(await hasCurrentConsent(userId))) return false;
    const data: DaySummaryJobData = { userId, date };
    await queue.add(COACH_DAY_SUMMARY_JOB, data, {
      jobId: daySummaryJobId(userId, date),
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 1,
    });
    return true;
  } catch (err) {
    console.error(JSON.stringify({ event: 'coach.day_summary_enqueue_failed', error: err instanceof Error ? err.name : 'unknown' }));
    return false;
  }
}

/**
 * The job body: new data, so any sentence already stored for today is replaced.
 * Written by the same engine the user's messages go to (the routes build theirs
 * with summaryEngineDeps too). Consent and the coach flag are checked again
 * inside, as they may have changed since the job was queued.
 */
export function runDaySummaryJob(data: DaySummaryJobData, deps: TodayDeps = {}): Promise<SummaryOutcome> {
  const engine = summaryEngineDeps({
    getProvider: getCoachProvider,
    getHostedProvider,
    clock: systemClock,
    telemetry: new LoggerCoachTelemetry(),
  });
  return generateTodaySummary(data.userId, { ...engine, ...deps, force: true });
}
