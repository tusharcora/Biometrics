import { prisma } from '../db/client';
import { getSleepGoalMinutes } from '../users/goals';
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { getLiveConfig } from './configs';
import type { ScoreConfig } from './configs/v1';
import { isCivilDate, shiftDate } from './dates';
import { scoreDay, PipelineResult } from './pipeline';
import type { DailyPoint } from './types';

export type ComputeOutcome = 'scored' | 'no-input' | 'no-user';

const SCORED_METRICS = ['HRV', 'RESTING_HR', 'SLEEP', 'STEPS'] as const;

// Enough history for the baseline window AND for the outlier filter to have its
// own trailing window behind the oldest baseline day.
function lookbackDays(cfg: ScoreConfig): number {
  return cfg.historyDays + cfg.outlier.windowDays;
}

async function loadSeries(userId: string, date: string, cfg: ScoreConfig) {
  const records = await prisma.biometricRecord.findMany({
    where: {
      userId,
      metricType: { in: [...SCORED_METRICS] },
      recordedAt: {
        gte: civilDateToUtcMidnight(shiftDate(date, -lookbackDays(cfg))),
        lte: civilDateToUtcMidnight(date),
      },
    },
    select: { metricType: true, value: true, recordedAt: true },
  });
  const by = (type: (typeof SCORED_METRICS)[number]): DailyPoint[] =>
    records
      .filter((r) => r.metricType === type)
      .map((r) => ({ date: r.recordedAt.toISOString().slice(0, 10), value: r.value }));
  return { hrv: by('HRV'), rhr: by('RESTING_HR'), sleep: by('SLEEP'), steps: by('STEPS') };
}

/**
 * The single scoring job: runs the five pure stages for one user-day and
 * persists BaselineSnapshot, UserDailyFeatures and DailyScore. Everything is an
 * upsert keyed on (user, date[, metric|type]), so recomputing is always safe
 * to repeat (BullMQ retries, a debounced webhook and the nightly sweep can all
 * land on the same day). It is one job, not a flow: there is no network call
 * and no stage that can fail independently of the others.
 *
 * "Day D" is the civil date key BiometricRecord already uses, so HRV(D), RHR(D)
 * and the SLEEP rollup(D) are the same night (Slice 0).
 */
export async function computeDailyScore(
  userId: string,
  date: string,
  opts: { config?: ScoreConfig } = {},
): Promise<ComputeOutcome> {
  if (!isCivilDate(date)) throw new Error(`Invalid score date "${date}": expected YYYY-MM-DD`);
  const cfg = opts.config ?? getLiveConfig();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return 'no-user';

  const series = await loadSeries(userId, date, cfg);
  const result = scoreDay({ date, ...series, sleepGoalMinutes: await getSleepGoalMinutes(userId) }, cfg);

  await persist(userId, result);
  return result.hasObservedInput ? 'scored' : 'no-input';
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r2n = (n: number | null) => (n === null ? null : r2(n));

async function persist(userId: string, result: PipelineResult): Promise<void> {
  const day = civilDateToUtcMidnight(result.date);

  // Outlier verdicts are stored whether or not there is anything left to score.
  // The raw BiometricRecord is never touched; a flag only tells the score to skip it.
  const flaggedMetrics = new Set(result.outlierFlags.map((f) => f.metric));
  const flagWrites = [
    ...result.outlierFlags.map(({ metric, flag }) =>
      prisma.scoreInputFlag.upsert({
        where: { userId_metric_date_flag: { userId, metric, date: day, flag: 'OUTLIER' } },
        update: { value: flag.value, median: flag.median, mad: flag.mad },
        create: { userId, metric, date: day, flag: 'OUTLIER', value: flag.value, median: flag.median, mad: flag.mad },
      }),
    ),
    // A value that is no longer an outlier (late data, a new config) drops its stale flag.
    prisma.scoreInputFlag.deleteMany({
      where: {
        userId,
        date: day,
        flag: 'OUTLIER',
        metric: { in: (['HRV', 'RESTING_HR'] as const).filter((m) => !flaggedMetrics.has(m)) },
      },
    }),
  ];

  if (!result.hasObservedInput) {
    // Nothing observed for the day: scoring it would just echo the baseline.
    // Remove any score left over from data that has since disappeared.
    await prisma.$transaction([
      ...flagWrites,
      prisma.dailyScore.deleteMany({ where: { userId, date: day, type: 'RECOVERY' } }),
      prisma.userDailyFeatures.deleteMany({ where: { userId, date: day } }),
      prisma.baselineSnapshot.deleteMany({ where: { userId, date: day } }),
    ]);
    return;
  }

  const f = result.features;
  const featureData = {
    algorithmVersion: result.algorithmVersion,
    sleepDebtRolling14d: r2n(f.sleepDebtRolling14d),
    hrvBaselineDeviationPct: r2n(f.hrvBaselineDeviationPct),
    rhrBaselineDeviationPct: r2n(f.rhrBaselineDeviationPct),
    acuteChronicLoadRatio: f.acuteChronicLoadRatio,
    hrvZ: f.hrvZ,
    hrvZImputed: f.hrvZImputed,
    rhrZ: f.rhrZ,
    rhrZImputed: f.rhrZImputed,
    sleepDurationZ: f.sleepDurationZ,
    sleepDurationZImputed: f.sleepDurationZImputed,
  };

  const factors = result.factors.map((x) => ({
    factor: x.factor,
    z: x.z,
    weight: x.weight,
    contribution: x.contribution,
    points: x.points,
    imputed: x.imputed,
    excluded: x.excluded,
  }));
  const scoreData = {
    algorithmVersion: result.algorithmVersion,
    score: r2n(result.score),
    confidenceLevel: result.confidenceLevel,
    factors,
  };

  await prisma.$transaction([
    ...flagWrites,
    ...result.baselines.map(({ metric, baseline }) => {
      const data = {
        algorithmVersion: result.algorithmVersion,
        daysOfHistory: baseline.daysOfHistory,
        ewma: baseline.coldStart ? null : baseline.ewma,
        spread: baseline.coldStart ? null : baseline.spread,
        mad: baseline.coldStart ? null : baseline.mad,
      };
      return prisma.baselineSnapshot.upsert({
        where: { userId_metric_date: { userId, metric, date: day } },
        update: data,
        create: { userId, metric, date: day, ...data },
      });
    }),
    prisma.userDailyFeatures.upsert({
      where: { userId_date: { userId, date: day } },
      update: featureData,
      create: { userId, date: day, ...featureData },
    }),
    prisma.dailyScore.upsert({
      where: { userId_date_type: { userId, date: day, type: 'RECOVERY' } },
      update: scoreData,
      create: { userId, date: day, type: 'RECOVERY', ...scoreData },
    }),
  ]);
}
