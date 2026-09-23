"use strict";
// The five stages composed for one user-day. Still pure (series in, values out,
// no DB): the orchestrator loads the series and persists the result, and the
// backtest tool replays the same function under a different config, so the
// live job and the backtest can never drift apart.
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreDay = scoreDay;
const baseline_1 = require("./baseline");
const clean_1 = require("./clean");
const composite_1 = require("./composite");
const dates_1 = require("./dates");
const explain_1 = require("./explain");
const features_1 = require("./features");
function upTo(points, date) {
    return points.filter((p) => p.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
}
function trailing(points, date, days) {
    const from = (0, dates_1.shiftDate)(date, -days);
    return points.filter((p) => p.date >= from && p.date < date);
}
/** HRV and RHR: a trending metric that is outlier-screened and gap-imputed from its own EWMA. */
function scoreTrendMetric(points, date, cfg, metric) {
    const series = upTo(points, date);
    const { kept, outliers } = (0, clean_1.rejectOutliers)(series, cfg);
    const outlier = outliers.find((o) => o.date === date);
    const today = kept.find((p) => p.date === date);
    const baseline = (0, baseline_1.computeBaseline)(trailing(kept, date, cfg.historyDays), cfg);
    if (baseline.coldStart) {
        return { baseline, z: null, imputed: false, deviationPct: null, observed: today !== undefined, outlier };
    }
    if (today) {
        return {
            baseline,
            z: (0, baseline_1.zScore)(today.value, baseline, cfg, metric),
            imputed: false,
            deviationPct: (0, features_1.baselineDeviationPct)(today.value, baseline.ewma),
            observed: true,
            outlier,
        };
    }
    const filled = (0, clean_1.imputeFromBaseline)(baseline);
    return {
        baseline,
        z: (0, baseline_1.zScore)(filled.value, baseline, cfg, metric),
        imputed: filled.imputed,
        deviationPct: 0,
        observed: false,
        outlier,
    };
}
/**
 * Sleep efficiency and bedtime consistency: scored against their own EWMA /
 * sigma-hat. Like SLEEP they are not outlier-screened. A day with no value is
 * imputed from the baseline centre (z = 0, flagged) once the baseline exists.
 */
function scoreOwnBaseline(series, date, cfg, metric) {
    const today = series.find((p) => p.date === date);
    const baseline = (0, baseline_1.computeBaseline)(trailing(series, date, cfg.historyDays), cfg);
    if (baseline.coldStart)
        return { baseline, z: null, imputed: false };
    return { baseline, z: (0, baseline_1.zScore)(today ? today.value : baseline.ewma, baseline, cfg, metric), imputed: !today };
}
function scoreDay(input, cfg) {
    const { date } = input;
    const hrv = scoreTrendMetric(input.hrv, date, cfg, 'HRV');
    const rhr = scoreTrendMetric(input.rhr, date, cfg, 'RESTING_HR');
    // SLEEP is not outlier-screened: a very short night is exactly what sleep
    // debt exists to capture, and rejecting it would hide the signal.
    const sleep = upTo(input.sleep, date);
    const sleepTonight = sleep.find((p) => p.date === date);
    const sleepBaseline = (0, baseline_1.computeBaseline)(trailing(sleep, date, cfg.historyDays), cfg);
    let sleepDurationZ = null;
    let sleepDurationZImputed = false;
    if (!sleepBaseline.coldStart) {
        sleepDurationZ = (0, baseline_1.zScore)(sleepTonight ? sleepTonight.value : sleepBaseline.ewma, sleepBaseline, cfg, 'SLEEP');
        sleepDurationZImputed = !sleepTonight;
    }
    // Sleep debt is z-scored against its own 30-day baseline (the debt series).
    const debtToday = (0, features_1.sleepDebtRolling)(sleep, date, input.sleepGoalMinutes, cfg);
    const debtSeries = (0, features_1.buildSleepDebtSeries)(sleep, date, input.sleepGoalMinutes, cfg);
    const debtBaseline = (0, baseline_1.computeBaseline)(trailing(debtSeries, date, cfg.historyDays), cfg);
    const debtZ = (0, baseline_1.zScore)(debtToday, debtBaseline, cfg, 'SLEEP_DEBT');
    const factorInputs = [
        { factor: 'HRV', z: hrv.z, imputed: hrv.imputed, excluded: hrv.z === null },
        { factor: 'RHR', z: rhr.z, imputed: rhr.imputed, excluded: rhr.z === null },
        // Imputed when tonight's night is missing: the window is then 13 nights + 0.
        { factor: 'SLEEP_DEBT', z: debtZ, imputed: !sleepTonight, excluded: debtZ === null },
    ];
    const composite = (0, composite_1.computeComposite)(factorInputs, cfg);
    // Slice 1.5 features and the Sleep Score. Reads SleepSession structure; the
    // Recovery computation above never sees any of this.
    const timeZone = input.timezone ?? 'UTC';
    const sessions = input.sessions ?? [];
    const efficiencySeries = (0, features_1.buildSleepEfficiencySeries)(sessions, timeZone, date);
    const circadianSeries = (0, features_1.buildCircadianSeries)((0, features_1.mainSessionOnsets)(sessions, timeZone), date, cfg);
    const efficiency = scoreOwnBaseline(efficiencySeries, date, cfg, 'SLEEP_EFFICIENCY');
    const circadian = scoreOwnBaseline(circadianSeries, date, cfg, 'CIRCADIAN_CONSISTENCY');
    let sleepScore = null;
    if (sleepTonight) {
        const durationZ = (0, baseline_1.sleepDurationZVsGoal)(sleepTonight.value, input.sleepGoalMinutes, sleepBaseline, cfg);
        // Duration's own [-3, +1] clamp is applied above; zRaw is the value before it.
        const durationZRaw = (0, baseline_1.sleepDurationZRawVsGoal)(sleepTonight.value, input.sleepGoalMinutes, sleepBaseline, cfg);
        const sleepInputs = [
            { factor: 'SLEEP_DURATION', z: durationZ, zRaw: durationZRaw, imputed: false, excluded: durationZ === null },
            { factor: 'SLEEP_EFFICIENCY', z: efficiency.z, imputed: efficiency.imputed, excluded: efficiency.z === null },
            { factor: 'CIRCADIAN_CONSISTENCY', z: circadian.z, imputed: circadian.imputed, excluded: circadian.z === null },
        ];
        const sleepComposite = (0, composite_1.computeComposite)(sleepInputs, cfg, cfg.sleepScore);
        sleepScore = {
            score: sleepComposite.score,
            confidenceLevel: sleepComposite.confidenceLevel,
            factors: (0, explain_1.explainFactors)(sleepComposite),
        };
    }
    const outlierFlags = [];
    if (hrv.outlier)
        outlierFlags.push({ metric: 'HRV', flag: hrv.outlier });
    if (rhr.outlier)
        outlierFlags.push({ metric: 'RESTING_HR', flag: rhr.outlier });
    return {
        date,
        algorithmVersion: cfg.version,
        hasObservedInput: hrv.observed || rhr.observed || sleepTonight !== undefined,
        outlierFlags,
        baselines: [
            { metric: 'HRV', baseline: hrv.baseline },
            { metric: 'RESTING_HR', baseline: rhr.baseline },
            { metric: 'SLEEP', baseline: sleepBaseline },
            { metric: 'SLEEP_DEBT', baseline: debtBaseline },
            { metric: 'SLEEP_EFFICIENCY', baseline: efficiency.baseline },
            { metric: 'CIRCADIAN_CONSISTENCY', baseline: circadian.baseline },
        ],
        features: {
            sleepDebtRolling14d: sleep.length > 0 ? debtToday : null,
            hrvBaselineDeviationPct: hrv.deviationPct,
            rhrBaselineDeviationPct: rhr.deviationPct,
            acuteChronicLoadRatio: (0, features_1.acuteChronicLoadRatio)(upTo(input.steps, date), date, cfg),
            hrvZ: hrv.z,
            hrvZImputed: hrv.imputed,
            rhrZ: rhr.z,
            rhrZImputed: rhr.imputed,
            sleepDurationZ,
            sleepDurationZImputed,
            sleepEfficiency: efficiencySeries.find((p) => p.date === date)?.value ?? null,
            sleepEfficiencyZ: efficiency.z,
            sleepEfficiencyZImputed: efficiency.imputed,
            circadianConsistencyScore: circadianSeries.find((p) => p.date === date)?.value ?? null,
            circadianConsistencyZ: circadian.z,
            circadianConsistencyZImputed: circadian.imputed,
        },
        score: composite.score,
        confidenceLevel: composite.confidenceLevel,
        factors: (0, explain_1.explainFactors)(composite),
        sleepScore,
    };
}
//# sourceMappingURL=pipeline.js.map