"use strict";
// Loads one user's habit logs, check-ins and factor series from the database
// and hands them to the pure engine. Kept apart from engine.ts so the engine
// stays free of I/O and the statistics are testable without a database.
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFactorSeries = loadFactorSeries;
exports.loadAnalysisInput = loadAnalysisInput;
exports.computeNotEnoughData = computeNotEnoughData;
exports.analyzeUser = analyzeUser;
const civilDate_1 = require("../biometrics/civilDate");
const client_1 = require("../db/client");
const dates_1 = require("../scoring/dates");
const config_1 = require("./config");
const engine_1 = require("./engine");
const habitDay_1 = require("./habitDay");
const habitTypes_1 = require("./habitTypes");
const observed_1 = require("./observed");
const isoDay = (d) => d.toISOString().slice(0, 10);
/** % deviation of `raw` from its baseline centre; null when either is missing or the baseline is ~0. */
function pctFromBaseline(raw, ewma) {
    if (raw === null || raw === undefined || ewma === null || ewma === undefined || Math.abs(ewma) < 1e-9)
        return null;
    return ((raw - ewma) / Math.abs(ewma)) * 100;
}
/**
 * The correlation series for [from, through], per factor, keyed by civil date.
 * Sources are UserDailyFeatures' per-night z columns and their imputed flags.
 * (sleepDebtRolling14d is never read here: see FactorKey in engine.ts.)
 */
async function loadFactorSeries(userId, from, through, 
/** Only z and imputed are needed (pair counting): skips the queries that exist solely to derive `pct`. */
opts = {}) {
    const range = { gte: (0, civilDate_1.civilDateToUtcMidnight)(from), lte: (0, civilDate_1.civilDateToUtcMidnight)(through) };
    const withPct = !opts.countsOnly;
    const [features, snapshots, sleep] = await Promise.all([
        client_1.prisma.userDailyFeatures.findMany({
            where: { userId, date: range },
            select: {
                date: true,
                hrvZ: true,
                hrvZImputed: true,
                rhrZ: true,
                rhrZImputed: true,
                sleepDurationZ: true,
                sleepDurationZImputed: true,
                sleepEfficiencyZ: true,
                sleepEfficiencyZImputed: true,
                circadianConsistencyZ: true,
                circadianConsistencyZImputed: true,
                hrvBaselineDeviationPct: true,
                rhrBaselineDeviationPct: true,
                sleepEfficiency: true,
                circadianConsistencyScore: true,
            },
        }),
        withPct
            ? client_1.prisma.baselineSnapshot.findMany({
                where: { userId, date: range, metric: { in: ['SLEEP', 'SLEEP_EFFICIENCY', 'CIRCADIAN_CONSISTENCY'] } },
                select: { date: true, metric: true, ewma: true },
            })
            : Promise.resolve([]),
        withPct
            ? client_1.prisma.biometricRecord.findMany({
                where: { userId, metricType: 'SLEEP', recordedAt: range },
                select: { recordedAt: true, value: true },
            })
            : Promise.resolve([]),
    ]);
    const ewma = new Map(snapshots.map((s) => [`${s.metric}|${isoDay(s.date)}`, s.ewma]));
    const sleepMinutes = new Map(sleep.map((s) => [isoDay(s.recordedAt), s.value]));
    const series = {
        HRV: new Map(),
        RHR: new Map(),
        SLEEP_DURATION: new Map(),
        SLEEP_EFFICIENCY: new Map(),
        CIRCADIAN_CONSISTENCY: new Map(),
    };
    for (const f of features) {
        const d = isoDay(f.date);
        series.HRV.set(d, { z: f.hrvZ, imputed: f.hrvZImputed, pct: f.hrvBaselineDeviationPct });
        series.RHR.set(d, { z: f.rhrZ, imputed: f.rhrZImputed, pct: f.rhrBaselineDeviationPct });
        // The sleep factors have no stored deviation column: derive it from that
        // day's raw value against that day's baseline EWMA.
        series.SLEEP_DURATION.set(d, {
            z: f.sleepDurationZ,
            imputed: f.sleepDurationZImputed,
            pct: pctFromBaseline(sleepMinutes.get(d), ewma.get(`SLEEP|${d}`)),
        });
        series.SLEEP_EFFICIENCY.set(d, {
            z: f.sleepEfficiencyZ,
            imputed: f.sleepEfficiencyZImputed,
            pct: pctFromBaseline(f.sleepEfficiency, ewma.get(`SLEEP_EFFICIENCY|${d}`)),
        });
        series.CIRCADIAN_CONSISTENCY.set(d, {
            z: f.circadianConsistencyZ,
            imputed: f.circadianConsistencyZImputed,
            pct: pctFromBaseline(f.circadianConsistencyScore, ewma.get(`CIRCADIAN_CONSISTENCY|${d}`)),
        });
    }
    return series;
}
/** Everything the engine needs for one user, over the trailing ANALYSIS_WINDOW_DAYS habit days. */
async function loadAnalysisInput(userId, now, opts = {}) {
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const today = (0, habitDay_1.habitDayFor)(now, user?.timezone ?? 'UTC');
    const from = (0, dates_1.shiftDate)(today, -config_1.ANALYSIS_WINDOW_DAYS);
    const fromDate = (0, civilDate_1.civilDateToUtcMidnight)(from);
    const [types, logs, checkIns] = await Promise.all([
        (0, habitTypes_1.listHabitTypes)(userId),
        client_1.prisma.habitLog.findMany({
            where: { userId, habitDay: { gte: fromDate } },
            select: { habitType: true, value: true, habitDay: true },
        }),
        client_1.prisma.habitCheckIn.findMany({ where: { userId, habitDay: { gte: fromDate } }, select: { habitDay: true } }),
    ]);
    const observed = (0, observed_1.buildObservedDays)(logs.map((l) => ({ habitType: l.habitType, value: l.value, habitDay: isoDay(l.habitDay) })), checkIns.map((c) => isoDay(c.habitDay)), 
    // A custom type is only observable from the day it was created, in the
    // user's own zone; before that its "unexposed" days are invented.
    types.map((t) => ({
        type: t.type,
        exposureThreshold: t.exposureThreshold,
        ...(t.createdAt ? { observedFrom: (0, habitDay_1.habitDayFor)(t.createdAt, user?.timezone ?? 'UTC') } : {}),
    })));
    const habits = types
        .map((t) => ({ habitType: t.type, observations: observed.get(t.type) ?? [] }))
        .filter((h) => h.observations.length > 0);
    // A habit on day H reaches at most H + 3, so the series must extend that far past today.
    const factors = await loadFactorSeries(userId, (0, dates_1.shiftDate)(from, 1), (0, dates_1.shiftDate)(today, 3), opts);
    return { input: { habits, factors }, types, today };
}
/**
 * The live "N of 8 needed" counts, WITHOUT running the statistics: no
 * correlation, p-value or BH step, and none of the queries that only feed effect
 * sizes. Identical to analyzeUser(...).notEnoughData by construction (both go
 * through the engine's pair-counting gate). Deliberately live, not read from a
 * stored weekly run, so the count moves as soon as the user logs "nothing today".
 */
async function computeNotEnoughData(userId, now) {
    const { input } = await loadAnalysisInput(userId, now, { countsOnly: true });
    return (0, engine_1.computeNotEnoughData)(input);
}
async function analyzeUser(userId, now) {
    const { input, types } = await loadAnalysisInput(userId, now);
    return { ...(0, engine_1.analyzeHabits)(input), types };
}
//# sourceMappingURL=analysis.js.map