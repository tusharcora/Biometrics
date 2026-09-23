export interface HabitLogLike {
    habitType: string;
    value: number;
    /** YYYY-MM-DD, as stored at write time. */
    habitDay: string;
}
export interface ObservedDay {
    day: string;
    exposed: boolean;
}
export interface ExposureRule {
    type: string;
    exposureThreshold: number;
    /**
     * The first day this type could be observed at all (YYYY-MM-DD). Check-in
     * days before it are not "the user did not do this", they are days the type
     * did not exist, and counting them as unexposed hands the control group ~90
     * invented days the moment a custom type is created.
     */
    observedFrom?: string;
}
/**
 * Per habit type, the observed habit days (ascending) with their exposure.
 *
 * A day is observed for type T when a T log exists for it (a value of 0 counts:
 * it is a real "none") or a check-in exists for it. Exposure applies the type's
 * threshold to the day's TOTAL for that type, so two 1-drink logs make a 2-drink
 * day. A check-in with no log of T is an observed day with total 0.
 */
export declare function buildObservedDays(logs: HabitLogLike[], checkInDays: string[], types: ExposureRule[]): Map<string, ObservedDay[]>;
//# sourceMappingURL=observed.d.ts.map