"use strict";
// The observed-day rule. "Didn't do it" and "didn't log it" look identical in
// raw data, so a day only counts for a habit type when the user said something
// about it; an unobserved day is MISSING, never a non-exposure. Without this,
// every unlogged day would silently become the control group.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildObservedDays = buildObservedDays;
/**
 * Per habit type, the observed habit days (ascending) with their exposure.
 *
 * A day is observed for type T when a T log exists for it (a value of 0 counts:
 * it is a real "none") or a check-in exists for it. Exposure applies the type's
 * threshold to the day's TOTAL for that type, so two 1-drink logs make a 2-drink
 * day. A check-in with no log of T is an observed day with total 0.
 */
function buildObservedDays(logs, checkInDays, types) {
    const checkedIn = new Set(checkInDays);
    const result = new Map();
    for (const { type, exposureThreshold, observedFrom } of types) {
        const totals = new Map();
        for (const log of logs) {
            if (log.habitType === type)
                totals.set(log.habitDay, (totals.get(log.habitDay) ?? 0) + log.value);
        }
        // A real log still counts even if it somehow predates the type; only the
        // implied zeroes are withheld.
        for (const day of checkedIn) {
            if (observedFrom !== undefined && day < observedFrom)
                continue;
            if (!totals.has(day))
                totals.set(day, 0);
        }
        const days = [...totals.entries()]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([day, total]) => ({ day, exposed: total >= exposureThreshold }));
        result.set(type, days);
    }
    return result;
}
//# sourceMappingURL=observed.js.map