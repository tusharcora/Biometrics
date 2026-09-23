"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v1Config = void 0;
exports.v1Config = {
    version: 'v1',
    // A product starting point, not derived from data (see ScoreConfig.scoreBands).
    scoreBands: { excellent: 75, good: 55, fair: 40 },
    weights: { HRV: 0.45, RHR: 0.35, SLEEP_DEBT: 0.2 },
    direction: { HRV: 1, RHR: -1, SLEEP_DEBT: -1 },
    k: Math.log(9) / 2,
    ewmaN: 30,
    minHistoryDays: 14,
    historyDays: 90,
    spreadWindow: 30,
    madToSigma: 1.4826,
    spreadFloorFraction: 0.02,
    outlier: { madMultiplier: 5, windowDays: 90, minHistory: 14 },
    sleepDebtWindowDays: 14,
    sleepScore: {
        // Illustrative, not derived (see ScoreConfig.sleepScore.weights).
        weights: { SLEEP_DURATION: 0.45, SLEEP_EFFICIENCY: 0.35, CIRCADIAN_CONSISTENCY: 0.2 },
        direction: { SLEEP_DURATION: 1, SLEEP_EFFICIENCY: 1, CIRCADIAN_CONSISTENCY: 1 },
        durationZClamp: { min: -3, max: 1 },
    },
    circadian: { windowDays: 14, minWindowNights: 7, minHistoryNights: 14, maxStdMinutes: 120 },
    acwr: { acuteDays: 7, chronicDays: 28, minChronicObservations: 14 },
};
//# sourceMappingURL=v1.js.map