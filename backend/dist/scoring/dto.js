"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASELINE_METRICS = exports.FACTOR_METRIC = exports.FACTOR_LABELS = void 0;
exports.toDailyScoreDTO = toDailyScoreDTO;
exports.toBaselineDTOs = toBaselineDTOs;
const configs_1 = require("./configs");
// RESTING_HR is Google's own daily resting heart rate (the dedicated
// daily-resting-heart-rate type), so it is labelled as what it is. It used to
// be the daily-minimum BPM proxy and read "Daily minimum HR".
exports.FACTOR_LABELS = {
    HRV: 'HRV',
    RHR: 'Resting HR',
    SLEEP_DEBT: 'Sleep debt',
    SLEEP_DURATION: 'Sleep duration',
    SLEEP_EFFICIENCY: 'Sleep efficiency',
    CIRCADIAN_CONSISTENCY: 'Bedtime consistency',
};
/** Which baseline series backs each factor; also the `metric` id used in cold-start and baseline DTOs. */
exports.FACTOR_METRIC = {
    HRV: 'HRV',
    RHR: 'RESTING_HR',
    SLEEP_DEBT: 'SLEEP_DEBT',
    // Duration is scored against the goal but its sigma-hat comes from the SLEEP series baseline.
    SLEEP_DURATION: 'SLEEP',
    SLEEP_EFFICIENCY: 'SLEEP_EFFICIENCY',
    CIRCADIAN_CONSISTENCY: 'CIRCADIAN_CONSISTENCY',
};
const METRIC_UNITS = {
    HRV: 'ms',
    RESTING_HR: 'bpm',
    SLEEP_DEBT: 'min',
    SLEEP: 'min',
    SLEEP_EFFICIENCY: '%',
    CIRCADIAN_CONSISTENCY: 'pts',
};
/**
 * Stored efficiency baselines are 0..1 fractions (the feature's own scale);
 * they are shown as percentages, so the wire value and its '%' unit agree.
 */
const METRIC_DISPLAY_SCALE = { SLEEP_EFFICIENCY: 100 };
/** Factors of each score type, in the order cold-start progress and baselines are listed. */
const FACTOR_ORDER = {
    RECOVERY: ['HRV', 'RHR', 'SLEEP_DEBT'],
    SLEEP: ['SLEEP_DURATION', 'SLEEP_EFFICIENCY', 'CIRCADIAN_CONSISTENCY'],
};
const round = (n, places) => {
    const p = 10 ** places;
    return Math.round(n * p) / p;
};
const roundOrNull = (n, places) => (n === null ? null : round(n, places));
/** The config a stored row was computed with; falls back to the live one for an unknown version. */
function configFor(version) {
    return configs_1.SCORE_CONFIGS[version] ?? configs_1.SCORE_CONFIGS[configs_1.LIVE_VERSION];
}
function toDailyScoreDTO(row, snapshotsForDate) {
    const cfg = configFor(row.algorithmVersion);
    const stored = row.factors;
    const factors = stored.map((f) => ({
        factor: f.factor,
        label: exports.FACTOR_LABELS[f.factor],
        z: roundOrNull(f.z, 2),
        weight: round(f.weight, 3),
        contribution: round(f.contribution, 3),
        points: round(f.points ?? 0, 2),
        imputed: f.imputed,
        excluded: f.excluded,
    }));
    const coldStart = FACTOR_ORDER[row.type].filter((k) => stored.find((f) => f.factor === k)?.excluded).map((k) => ({
        metric: exports.FACTOR_METRIC[k],
        daysCollected: snapshotsForDate.find((s) => s.metric === exports.FACTOR_METRIC[k])?.daysOfHistory ?? 0,
        daysRequired: cfg.minHistoryDays,
    }));
    return {
        date: row.date.toISOString().slice(0, 10),
        type: row.type,
        score: roundOrNull(row.score, 1),
        confidenceLevel: row.confidenceLevel,
        algorithmVersion: row.algorithmVersion,
        factors,
        coldStart,
    };
}
/** Baselines a score of `type` was computed against: only factor series that are past cold-start. */
function toBaselineDTOs(snapshots, type = 'RECOVERY') {
    const out = [];
    for (const key of FACTOR_ORDER[type]) {
        const snap = snapshots.find((s) => s.metric === exports.FACTOR_METRIC[key]);
        if (!snap || snap.ewma === null || snap.spread === null)
            continue;
        const scale = METRIC_DISPLAY_SCALE[snap.metric] ?? 1;
        out.push({
            metric: snap.metric,
            ewma: round(snap.ewma * scale, 2),
            spread: round(snap.spread * scale, 2),
            daysOfHistory: snap.daysOfHistory,
            windowDays: configFor(snap.algorithmVersion).ewmaN,
            unit: METRIC_UNITS[snap.metric] ?? '',
        });
    }
    return out;
}
exports.BASELINE_METRICS = Object.values(exports.FACTOR_METRIC);
//# sourceMappingURL=dto.js.map