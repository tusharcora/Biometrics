"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDailyScore = computeDailyScore;
const client_1 = require("../db/client");
const goals_1 = require("../users/goals");
const civilDate_1 = require("../biometrics/civilDate");
const configs_1 = require("./configs");
const dates_1 = require("./dates");
const pipeline_1 = require("./pipeline");
const SCORED_METRICS = ['HRV', 'RESTING_HR', 'SLEEP', 'STEPS'];
// Enough history for the baseline window AND for the outlier filter to have its
// own trailing window behind the oldest baseline day.
function lookbackDays(cfg) {
    return cfg.historyDays + cfg.outlier.windowDays;
}
async function loadSeries(userId, date, cfg) {
    const records = await client_1.prisma.biometricRecord.findMany({
        where: {
            userId,
            metricType: { in: [...SCORED_METRICS] },
            recordedAt: {
                gte: (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(date, -lookbackDays(cfg))),
                lte: (0, civilDate_1.civilDateToUtcMidnight)(date),
            },
        },
        select: { metricType: true, value: true, recordedAt: true },
    });
    const by = (type) => records
        .filter((r) => r.metricType === type)
        .map((r) => ({ date: r.recordedAt.toISOString().slice(0, 10), value: r.value }));
    return { hrv: by('HRV'), rhr: by('RESTING_HR'), sleep: by('SLEEP'), steps: by('STEPS') };
}
/**
 * Stored sessions ending in the score window, for the Sleep Score's structural
 * features. The range is padded a day either side of the civil-date window
 * because a session's local end date (in the user's zone) can differ from its
 * UTC end date by up to a day; the exact bucketing is done per-session in the
 * pipeline.
 */
async function loadSessions(userId, date, cfg) {
    return client_1.prisma.sleepSession.findMany({
        where: {
            userId,
            endTime: {
                gte: (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(date, -lookbackDays(cfg) - 1)),
                lt: (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(date, 2)),
            },
        },
        select: { startTime: true, endTime: true, minutesAsleep: true, startUtcOffsetSeconds: true, endUtcOffsetSeconds: true },
    });
}
/**
 * The single scoring job: runs the five pure stages for one user-day and
 * persists BaselineSnapshot, UserDailyFeatures and both DailyScore rows
 * (RECOVERY, and SLEEP when the night was observed). Everything is an
 * upsert keyed on (user, date[, metric|type]), so recomputing is always safe
 * to repeat (BullMQ retries, a debounced webhook and the nightly sweep can all
 * land on the same day). It never short-circuits on an existing score, so a
 * row written by an older algorithm version is simply overwritten with the live
 * version's answer (the sweep enqueues such days as stale). It is one job, not
 * a flow: there is no network call and no stage that can fail independently of
 * the others.
 *
 * "Day D" is the civil date key BiometricRecord already uses, so HRV(D), RHR(D)
 * and the SLEEP rollup(D) are the same night (Slice 0).
 */
async function computeDailyScore(userId, date, opts = {}) {
    if (!(0, dates_1.isCivilDate)(date))
        throw new Error(`Invalid score date "${date}": expected YYYY-MM-DD`);
    const cfg = opts.config ?? (0, configs_1.getLiveConfig)();
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true, timezone: true } });
    if (!user)
        return 'no-user';
    const series = await loadSeries(userId, date, cfg);
    const sessions = await loadSessions(userId, date, cfg);
    const result = (0, pipeline_1.scoreDay)({ date, ...series, sessions, timezone: user.timezone, sleepGoalMinutes: await (0, goals_1.getSleepGoalMinutes)(userId) }, cfg);
    try {
        await persist(userId, result);
    }
    catch (err) {
        // The account was deleted while this job was computing: the write hit a
        // foreign-key violation. That is the same outcome as the user having been
        // gone at the start, not a failure to retry.
        if (err?.code === 'P2003' && !(await client_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
            return 'no-user';
        }
        throw err;
    }
    return result.hasObservedInput ? 'scored' : 'no-input';
}
const r2 = (n) => Math.round(n * 100) / 100;
const r2n = (n) => (n === null ? null : r2(n));
/** The DailyScore columns for one composite outcome (Recovery is the pipeline result itself, which has the same shape). */
function scoreRowData(algorithmVersion, outcome) {
    return {
        algorithmVersion,
        score: r2n(outcome.score),
        confidenceLevel: outcome.confidenceLevel,
        factors: outcome.factors.map((x) => ({
            factor: x.factor,
            z: x.z,
            // Only present under a config with a zClamp; the shape of older versions' rows is unchanged.
            ...(x.zRaw !== undefined ? { zRaw: x.zRaw } : {}),
            weight: x.weight,
            contribution: x.contribution,
            points: x.points,
            imputed: x.imputed,
            excluded: x.excluded,
        })),
    };
}
async function persist(userId, result) {
    const day = (0, civilDate_1.civilDateToUtcMidnight)(result.date);
    // Outlier verdicts are stored whether or not there is anything left to score.
    // The raw BiometricRecord is never touched; a flag only tells the score to skip it.
    const flaggedMetrics = new Set(result.outlierFlags.map((f) => f.metric));
    const flagWrites = [
        ...result.outlierFlags.map(({ metric, flag }) => client_1.prisma.scoreInputFlag.upsert({
            where: { userId_metric_date_flag: { userId, metric, date: day, flag: 'OUTLIER' } },
            update: { value: flag.value, median: flag.median, mad: flag.mad },
            create: { userId, metric, date: day, flag: 'OUTLIER', value: flag.value, median: flag.median, mad: flag.mad },
        })),
        // A value that is no longer an outlier (late data, a new config) drops its stale flag.
        client_1.prisma.scoreInputFlag.deleteMany({
            where: {
                userId,
                date: day,
                flag: 'OUTLIER',
                metric: { in: ['HRV', 'RESTING_HR'].filter((m) => !flaggedMetrics.has(m)) },
            },
        }),
    ];
    if (!result.hasObservedInput) {
        // Nothing observed for the day: scoring it would just echo the baseline.
        // Remove any score left over from data that has since disappeared.
        await client_1.prisma.$transaction([
            ...flagWrites,
            client_1.prisma.dailyScore.deleteMany({ where: { userId, date: day } }),
            client_1.prisma.userDailyFeatures.deleteMany({ where: { userId, date: day } }),
            client_1.prisma.baselineSnapshot.deleteMany({ where: { userId, date: day } }),
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
        sleepEfficiency: f.sleepEfficiency,
        sleepEfficiencyZ: f.sleepEfficiencyZ,
        sleepEfficiencyZImputed: f.sleepEfficiencyZImputed,
        circadianConsistencyScore: r2n(f.circadianConsistencyScore),
        circadianConsistencyZ: f.circadianConsistencyZ,
        circadianConsistencyZImputed: f.circadianConsistencyZImputed,
    };
    const scoreData = scoreRowData(result.algorithmVersion, result);
    const sleepData = result.sleepScore ? scoreRowData(result.algorithmVersion, result.sleepScore) : null;
    await client_1.prisma.$transaction([
        ...flagWrites,
        ...result.baselines.map(({ metric, baseline }) => {
            const data = {
                algorithmVersion: result.algorithmVersion,
                daysOfHistory: baseline.daysOfHistory,
                ewma: baseline.coldStart ? null : baseline.ewma,
                spread: baseline.coldStart ? null : baseline.spread,
                mad: baseline.coldStart ? null : baseline.mad,
            };
            return client_1.prisma.baselineSnapshot.upsert({
                where: { userId_metric_date: { userId, metric, date: day } },
                update: data,
                create: { userId, metric, date: day, ...data },
            });
        }),
        client_1.prisma.userDailyFeatures.upsert({
            where: { userId_date: { userId, date: day } },
            update: featureData,
            create: { userId, date: day, ...featureData },
        }),
        client_1.prisma.dailyScore.upsert({
            where: { userId_date_type: { userId, date: day, type: 'RECOVERY' } },
            update: scoreData,
            create: { userId, date: day, type: 'RECOVERY', ...scoreData },
        }),
        // The Sleep Score exists only for a night that was actually recorded; a
        // stale one (its sleep data since removed) is dropped rather than left behind.
        ...(sleepData
            ? [
                client_1.prisma.dailyScore.upsert({
                    where: { userId_date_type: { userId, date: day, type: 'SLEEP' } },
                    update: sleepData,
                    create: { userId, date: day, type: 'SLEEP', ...sleepData },
                }),
            ]
            : [client_1.prisma.dailyScore.deleteMany({ where: { userId, date: day, type: 'SLEEP' } })]),
    ]);
}
//# sourceMappingURL=compute.js.map