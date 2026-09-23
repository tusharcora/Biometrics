"use strict";
// The habit <-> biometric correlation engine (spec section 2, steps 1-6 and the
// structured output). Pure: it takes already-loaded observed habit days and
// factor series and returns every hypothesis it tested plus the habits it
// declined to test. Persistence (steps 8-9) lives in job.ts / lifecycle.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRELATION_FACTORS = void 0;
exports.computeNotEnoughData = computeNotEnoughData;
exports.analyzeHabits = analyzeHabits;
const dates_1 = require("../scoring/dates");
const config_1 = require("./config");
const stats_1 = require("./stats");
exports.CORRELATION_FACTORS = [
    'HRV',
    'RHR',
    'SLEEP_DURATION',
    'SLEEP_EFFICIENCY',
    'CIRCADIAN_CONSISTENCY',
];
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const meanOf = (xs) => (xs.length === 0 ? null : xs.reduce((s, v) => s + v, 0) / xs.length);
const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);
const round2 = (n) => Math.round(n * 100) / 100;
/**
 * Pairs each observed habit day H with the factor on civil date H + lag,
 * keeping only pairs whose factor value is a real observation. A habit day
 * that is unobserved never reaches here (buildObservedDays excludes it), so
 * it can never be counted as a non-exposure.
 */
function pairUp(observations, series, lag) {
    const pairs = [];
    for (const { day, exposed } of observations) {
        const factorDay = (0, dates_1.shiftDate)(day, lag);
        const f = series.get(factorDay);
        if (!f || f.z === null || f.imputed)
            continue;
        pairs.push({ day, factorDay, exposed, z: f.z, pct: f.pct });
    }
    return pairs;
}
function sparkline(observations, series, lag) {
    const out = { days: [], habit: [], factor: [] };
    for (const { day, exposed } of observations) {
        const f = series.get((0, dates_1.shiftDate)(day, lag));
        out.days.push(day);
        out.habit.push(exposed ? 1 : 0);
        out.factor.push(f && f.z !== null && !f.imputed ? round2(f.z) : null);
    }
    return out;
}
const meanPct = (pairs) => meanOf(pairs.flatMap((p) => (p.pct === null ? [] : [p.pct])));
function testPairs(pairs) {
    // De-seasonalize each series by its OWN weekday. The factor lags the habit by
    // a fixed number of days, so its weekday is the habit's weekday shifted, and
    // both weekly rhythms are removed before anything else is computed.
    const x = (0, stats_1.deseasonalize)(pairs.map((p) => (p.exposed ? 1 : 0)), pairs.map((p) => weekdayOf(p.day)));
    const y = (0, stats_1.deseasonalize)(pairs.map((p) => p.z), pairs.map((p) => weekdayOf(p.factorDay)));
    const first = pairs[0].day;
    const dayNumbers = pairs.map((p) => (0, dates_1.daysBetween)(first, p.day));
    const r = (0, stats_1.pearson)(x, y);
    const nEff = (0, stats_1.effectiveSampleSize)(pairs.length, (0, stats_1.lag1Autocorrelation)(x, dayNumbers), (0, stats_1.lag1Autocorrelation)(y, dayNumbers));
    // The weekday means removed above were fitted from these same pairs, so they
    // cost degrees of freedom; charging nothing for them understates the p-value.
    const seasonalParams = (0, stats_1.seasonalParamsFor)(pairs.map((p) => weekdayOf(p.day)));
    return { r, pValue: (0, stats_1.correlationPValue)(r, nEff, seasonalParams), nEff };
}
/** Keeps the (factor, lag) with the largest min(exposed, unexposed), ties broken by total pairs. */
function keepBest(best, exposed, unexposed) {
    const fewer = Math.min(exposed, unexposed);
    const bestFewer = Math.min(best.exposed, best.unexposed);
    if (fewer > bestFewer || (fewer === bestFewer && exposed + unexposed > best.exposed + best.unexposed)) {
        best.exposed = exposed;
        best.unexposed = unexposed;
    }
}
const passesObservationGate = (exposed, unexposed) => exposed >= config_1.MIN_PAIRS_EACH && unexposed >= config_1.MIN_PAIRS_EACH;
/**
 * The min-observation gate on its own: for each habit, the observed exposed /
 * unexposed pair counts at the best (factor, lag), and whether ANY (factor, lag)
 * clears the gate. Runs no correlation, p-value or BH step. analyzeHabits'
 * notEnoughData is exactly this, so the two can never disagree.
 */
function computeNotEnoughData(input) {
    const out = [];
    for (const { habitType, observations } of input.habits) {
        const best = { exposed: 0, unexposed: 0 };
        let testable = false;
        for (const factor of exports.CORRELATION_FACTORS) {
            const series = input.factors[factor];
            if (!series)
                continue;
            for (const lag of config_1.CORRELATION_LAGS) {
                let exposed = 0;
                let unexposed = 0;
                for (const p of pairUp(observations, series, lag))
                    p.exposed ? exposed++ : unexposed++;
                keepBest(best, exposed, unexposed);
                if (passesObservationGate(exposed, unexposed))
                    testable = true;
            }
        }
        if (!testable)
            out.push({ habitType, exposedDays: best.exposed, unexposedDays: best.unexposed, requiredEach: config_1.MIN_PAIRS_EACH });
    }
    return out;
}
function analyzeHabits(input) {
    const tested = [];
    // Best (largest min side) pair counts seen per habit, for the "3 of 8" message.
    const bestCounts = new Map();
    const testable = new Set();
    for (const { habitType, observations } of input.habits) {
        bestCounts.set(habitType, { exposed: 0, unexposed: 0 });
        for (const factor of exports.CORRELATION_FACTORS) {
            const series = input.factors[factor];
            if (!series)
                continue;
            for (const lag of config_1.CORRELATION_LAGS) {
                const pairs = pairUp(observations, series, lag);
                const exposedPairs = pairs.filter((p) => p.exposed);
                const unexposedPairs = pairs.filter((p) => !p.exposed);
                keepBest(bestCounts.get(habitType), exposedPairs.length, unexposedPairs.length);
                // Minimum-observation gate: the autocorrelation estimate and the t
                // approximation are both unreliable on tiny samples, and a comparison
                // with almost no unexposed days is not a comparison.
                if (!passesObservationGate(exposedPairs.length, unexposedPairs.length))
                    continue;
                const { r, pValue, nEff } = testPairs(pairs);
                const effect = round1(meanPct(exposedPairs));
                const comparison = round1(meanPct(unexposedPairs));
                testable.add(habitType);
                tested.push({
                    habitType,
                    factor,
                    lagDays: lag,
                    r,
                    pValue,
                    nEff,
                    sampleSize: pairs.length,
                    exposedPairs: exposedPairs.length,
                    unexposedPairs: unexposedPairs.length,
                    effectSizePercent: effect,
                    comparisonPercent: comparison,
                    direction: effect !== null && comparison !== null && effect < comparison ? 'lower' : 'higher',
                    series: sparkline(observations, series, lag),
                });
            }
        }
    }
    // One BH correction across the WHOLE run: the family is every (habit, factor,
    // lag) actually tested, not each habit separately.
    const q = (0, stats_1.benjaminiHochberg)(tested.map((t) => t.pValue));
    const hypotheses = tested.map((t, i) => ({
        ...t,
        qValue: q[i],
        passes: q[i] < config_1.FDR_Q && Math.abs(t.r) > config_1.MIN_ABS_R && t.effectSizePercent !== null && t.comparisonPercent !== null,
    }));
    const notEnoughData = [];
    for (const { habitType } of input.habits) {
        if (testable.has(habitType))
            continue;
        const c = bestCounts.get(habitType);
        notEnoughData.push({ habitType, exposedDays: c.exposed, unexposedDays: c.unexposed, requiredEach: config_1.MIN_PAIRS_EACH });
    }
    return { hypotheses, notEnoughData };
}
//# sourceMappingURL=engine.js.map