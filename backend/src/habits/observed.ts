// The observed-day rule. "Didn't do it" and "didn't log it" look identical in
// raw data, so a day only counts for a habit type when the user said something
// about it; an unobserved day is MISSING, never a non-exposure. Without this,
// every unlogged day would silently become the control group.

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
}

/**
 * Per habit type, the observed habit days (ascending) with their exposure.
 *
 * A day is observed for type T when a T log exists for it (a value of 0 counts:
 * it is a real "none") or a check-in exists for it. Exposure applies the type's
 * threshold to the day's TOTAL for that type, so two 1-drink logs make a 2-drink
 * day. A check-in with no log of T is an observed day with total 0.
 */
export function buildObservedDays(
  logs: HabitLogLike[],
  checkInDays: string[],
  types: ExposureRule[],
): Map<string, ObservedDay[]> {
  const checkedIn = new Set(checkInDays);
  const result = new Map<string, ObservedDay[]>();

  for (const { type, exposureThreshold } of types) {
    const totals = new Map<string, number>();
    for (const log of logs) {
      if (log.habitType === type) totals.set(log.habitDay, (totals.get(log.habitDay) ?? 0) + log.value);
    }
    for (const day of checkedIn) if (!totals.has(day)) totals.set(day, 0);

    const days = [...totals.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([day, total]) => ({ day, exposed: total >= exposureThreshold }));
    result.set(type, days);
  }
  return result;
}
