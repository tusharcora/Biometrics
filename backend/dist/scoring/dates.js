"use strict";
// Civil-date arithmetic on YYYY-MM-DD strings, done in UTC so DST and the
// server's own zone can never shift a day. The strings are already civil dates
// (Slice 0 aligned every metric to one), so no timezone is involved here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCivilDate = isCivilDate;
exports.shiftDate = shiftDate;
exports.daysBetween = daysBetween;
exports.dateRange = dateRange;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isCivilDate(value) {
    if (typeof value !== 'string' || !DATE_RE.test(value))
        return false;
    const d = new Date(`${value}T00:00:00Z`);
    // Round-trip rejects impossible dates like 2026-02-31, which Date would roll over.
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function toMs(date) {
    if (!isCivilDate(date))
        throw new Error(`Invalid civil date "${date}": expected YYYY-MM-DD`);
    return new Date(`${date}T00:00:00Z`).getTime();
}
function shiftDate(date, days) {
    return new Date(toMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}
/** Whole days from `from` to `to` (positive when `to` is later). */
function daysBetween(from, to) {
    return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}
/** Inclusive list of dates from `start` to `end`. */
function dateRange(start, end) {
    const out = [];
    for (let d = start; d <= end; d = shiftDate(d, 1))
        out.push(d);
    return out;
}
//# sourceMappingURL=dates.js.map