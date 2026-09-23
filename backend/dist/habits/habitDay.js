"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.habitDayFor = habitDayFor;
const civilDate_1 = require("../biometrics/civilDate");
const dates_1 = require("../scoring/dates");
const config_1 = require("./config");
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
function habitDayFor(loggedAt, timeZone) {
    const localMinutes = ((0, civilDate_1.minutesSinceLocalNoon)(loggedAt, timeZone) + 12 * 60) % (24 * 60);
    const date = (0, civilDate_1.localCivilDate)(loggedAt, timeZone);
    return localMinutes < config_1.HABIT_DAY_START_HOUR * 60 ? (0, dates_1.shiftDate)(date, -1) : date;
}
//# sourceMappingURL=habitDay.js.map