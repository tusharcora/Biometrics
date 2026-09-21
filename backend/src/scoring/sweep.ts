import { prisma } from '../db/client';
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { shiftDate } from './dates';
import { enqueueScoreCompute, ScoreQueue } from './queue';
import { syncQueue } from '../sync/queue';

/** How far back the sweep back-fills missing scores. */
export const SWEEP_LOOKBACK_DAYS = 90;

const SCORE_INPUT_METRICS = ['HRV', 'RESTING_HR', 'SLEEP'] as const;

export interface SweepSummary {
  usersChecked: number;
  jobsEnqueued: number;
}

/**
 * The correctness backstop behind the debounced per-webhook trigger: finds every
 * (user, date) in the lookback window that has score inputs but either no
 * RECOVERY score (a missed debounce, a first run, a day back-filled after the
 * fact) or a score older than the newest input's syncedAt, and enqueues the
 * same single computeDailyScore job for it. Delay 0: the sweep is already the
 * slow path, and the deterministic job id still collapses it into a job the
 * webhook path queued a moment earlier.
 */
export async function runScoreSweep({
  queue = syncQueue,
  now = new Date(),
  lookbackDays = SWEEP_LOOKBACK_DAYS,
}: { queue?: ScoreQueue; now?: Date; lookbackDays?: number } = {}): Promise<SweepSummary> {
  const today = now.toISOString().slice(0, 10);
  const since = civilDateToUtcMidnight(shiftDate(today, -lookbackDays));

  // Newest sync time per (user, date) across the score-input metrics.
  const inputs = await prisma.biometricRecord.groupBy({
    by: ['userId', 'recordedAt'],
    where: { metricType: { in: [...SCORE_INPUT_METRICS] }, recordedAt: { gte: since } },
    _max: { syncedAt: true },
  });
  if (inputs.length === 0) return { usersChecked: 0, jobsEnqueued: 0 };

  const userIds = [...new Set(inputs.map((i) => i.userId))];
  const scores = await prisma.dailyScore.findMany({
    where: { userId: { in: userIds }, type: 'RECOVERY', date: { gte: since } },
    select: { userId: true, date: true, updatedAt: true },
  });
  const scoredAt = new Map(scores.map((s) => [`${s.userId}|${s.date.toISOString().slice(0, 10)}`, s.updatedAt]));

  let jobsEnqueued = 0;
  for (const input of inputs) {
    const date = input.recordedAt.toISOString().slice(0, 10);
    const last = scoredAt.get(`${input.userId}|${date}`);
    const newestInput = input._max.syncedAt;
    const stale = last === undefined || (newestInput !== null && newestInput > last);
    if (!stale) continue;
    await enqueueScoreCompute(input.userId, date, { queue, delayMs: 0 });
    jobsEnqueued++;
  }
  return { usersChecked: userIds.length, jobsEnqueued };
}
