/** A log made before this local hour belongs to the previous habit day (1am drink = last evening's). */
export declare const HABIT_DAY_START_HOUR = 4;
/** Lag L pairs a habit on habit day H with the factor on civil date H + L. No lag 0: that night is already over. */
export declare const CORRELATION_LAGS: readonly [1, 2, 3];
/** Observed pairs required on EACH side (exposed, unexposed) before a hypothesis is tested at all. */
export declare const MIN_PAIRS_EACH = 8;
/** Benjamini-Hochberg FDR level, applied across every hypothesis of one run. */
export declare const FDR_Q = 0.1;
/** Minimum |r| a hypothesis must also clear: a tiny effect can be "significant" without being worth surfacing. */
export declare const MIN_ABS_R = 0.3;
/** How far back the engine looks. Long enough for ~4 months of weekly reruns to matter, short enough that stale behaviour ages out. */
export declare const ANALYSIS_WINDOW_DAYS = 120;
/** Retroactive check-ins: today plus this many previous habit days. */
export declare const CHECK_IN_BACKFILL_DAYS = 7;
export interface HabitTypeConfig {
    type: string;
    label: string;
    unit: string;
    exposureThreshold: number;
    builtIn: boolean;
    /**
     * When a custom type was created. Days before it cannot be observations of
     * it -- the user had no way to log something that did not exist yet -- so
     * they must not be seeded as "unexposed". Absent for built-ins, which have
     * always been available.
     */
    createdAt?: Date;
}
export declare const BUILT_IN_HABIT_TYPES: readonly HabitTypeConfig[];
//# sourceMappingURL=config.d.ts.map