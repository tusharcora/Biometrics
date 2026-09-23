"use strict";
// Fixed engine configuration. Exposure thresholds and the gates below are
// deliberately constants, not fitted to a user's data: choosing the
// best-looking threshold per user would multiply the number of hypotheses
// tested without counting them (spec section 1.4).
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_HABIT_TYPES = exports.CHECK_IN_BACKFILL_DAYS = exports.ANALYSIS_WINDOW_DAYS = exports.MIN_ABS_R = exports.FDR_Q = exports.MIN_PAIRS_EACH = exports.CORRELATION_LAGS = exports.HABIT_DAY_START_HOUR = void 0;
/** A log made before this local hour belongs to the previous habit day (1am drink = last evening's). */
exports.HABIT_DAY_START_HOUR = 4;
/** Lag L pairs a habit on habit day H with the factor on civil date H + L. No lag 0: that night is already over. */
exports.CORRELATION_LAGS = [1, 2, 3];
/** Observed pairs required on EACH side (exposed, unexposed) before a hypothesis is tested at all. */
exports.MIN_PAIRS_EACH = 8;
/** Benjamini-Hochberg FDR level, applied across every hypothesis of one run. */
exports.FDR_Q = 0.1;
/** Minimum |r| a hypothesis must also clear: a tiny effect can be "significant" without being worth surfacing. */
exports.MIN_ABS_R = 0.3;
/** How far back the engine looks. Long enough for ~4 months of weekly reruns to matter, short enough that stale behaviour ages out. */
exports.ANALYSIS_WINDOW_DAYS = 120;
/** Retroactive check-ins: today plus this many previous habit days. */
exports.CHECK_IN_BACKFILL_DAYS = 7;
// Built-ins live in code (not seeded per user) so a threshold change ships with
// a deploy. Alcohol >= 2 drinks, caffeine >= 3 cups, a workout of >= 20 minutes.
exports.BUILT_IN_HABIT_TYPES = [
    { type: 'ALCOHOL', label: 'Alcohol', unit: 'drinks', exposureThreshold: 2, builtIn: true },
    { type: 'CAFFEINE', label: 'Caffeine', unit: 'cups', exposureThreshold: 3, builtIn: true },
    { type: 'WORKOUT', label: 'Workout', unit: 'minutes', exposureThreshold: 20, builtIn: true },
];
//# sourceMappingURL=config.js.map