export declare function isValidTimeZone(timeZone: unknown): timeZone is string;
/** YYYY-MM-DD of `instant` on the wall clock in `timeZone`. */
export declare function localCivilDate(instant: Date, timeZone: string): string;
/** UTC midnight of a YYYY-MM-DD civil date: the `recordedAt` convention shared by all four metrics. */
export declare function civilDateToUtcMidnight(civilDate: string): Date;
/**
 * Parses Google's `startUtcOffset` / `endUtcOffset` (a Duration string such as
 * "-14400s", "19800s", "0s") into whole seconds east of UTC. Anything else,
 * including fractional seconds, a missing "s", stray whitespace, a non-string
 * or an out-of-range value, is null: the caller then falls back to
 * User.timezone rather than propagate a NaN into a date.
 */
export declare function parseUtcOffsetSeconds(raw: unknown): number | null;
/**
 * The local civil date a sleep session's END belongs to (the SLEEP rollup key,
 * and the night an HRV / resting-HR day is attributed to). The record's own
 * `endUtcOffsetSeconds` wins when present: it is the offset Google itself used,
 * so it stays right when the user travels. Without it (a row stored before the
 * offsets were captured, or a malformed value) it falls back to User.timezone.
 */
export declare function sessionEndCivilDate(session: {
    endTime: Date;
    endUtcOffsetSeconds?: number | null;
}, timeZone: string): string;
/**
 * Minutes since 12:00 local of a session's START (its bedtime), using the
 * record's own `startUtcOffsetSeconds` when present and User.timezone
 * otherwise. Same noon-anchoring as minutesSinceLocalNoon.
 */
export declare function sessionStartMinutesSinceLocalNoon(session: {
    startTime: Date;
    startUtcOffsetSeconds?: number | null;
}, timeZone: string): number;
/**
 * Minutes elapsed since 12:00 (noon) local wall-clock time, in [0, 1440).
 * Noon-anchored so a night's bedtimes (say 22:00 .. 02:00) form one contiguous
 * run (600 .. 840) instead of wrapping around midnight, which would make
 * 23:30 and 00:30 look 23 hours apart. Anchoring at noon is safe because
 * nobody's main sleep starts near noon.
 */
export declare function minutesSinceLocalNoon(instant: Date, timeZone: string): number;
//# sourceMappingURL=civilDate.d.ts.map