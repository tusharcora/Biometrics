/**
 * The habit day a log belongs to: the local civil date of `loggedAt` in
 * `timeZone`, except that anything before HABIT_DAY_START_HOUR local counts as
 * the PREVIOUS day (a 1am drink is part of the evening before).
 *
 * The wall-clock hour is read directly rather than by subtracting four hours
 * of absolute time from the instant: on a DST-change night that subtraction
 * lands an hour off the boundary.
 *
 * Callers store the result at write time. Recomputing it later from a changed
 * User.timezone would silently rewrite history.
 */
export declare function habitDayFor(loggedAt: Date, timeZone: string): string;
//# sourceMappingURL=habitDay.d.ts.map