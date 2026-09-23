"use strict";
// Coach tools over the user's own daily metrics and habit logs. Same contract
// as the score tools: read-only, structured fields only, every comparison
// (delta, direction, percent of goal, averages) computed HERE so the model
// never does arithmetic, and ready-made display strings for values a person
// reads with separators or units ("9,234", "7h 12m"). Resolved references are
// rendered with String(value), so a raw 9234 would read "9234".
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_HABIT_LOG_DAYS = exports.STEPS_GOAL = exports.METRIC_KEYS = void 0;
exports.roundMetric = roundMetric;
exports.formatSteps = formatSteps;
exports.formatDuration = formatDuration;
exports.describeChange = describeChange;
exports.getDailyMetrics = getDailyMetrics;
exports.dateLabel = dateLabel;
exports.describeTrend = describeTrend;
exports.computeTrend = computeTrend;
exports.getMetricHistory = getMetricHistory;
exports.getHabitLogs = getHabitLogs;
const civilDate_1 = require("../../biometrics/civilDate");
const client_1 = require("../../db/client");
const habitTypes_1 = require("../../habits/habitTypes");
const dates_1 = require("../../scoring/dates");
const goals_1 = require("../../users/goals");
const dailyScore_1 = require("./dailyScore");
exports.METRIC_KEYS = ['STEPS', 'RESTING_HR', 'HRV', 'SLEEP'];
// The same goal the app draws the steps ring and heat map against (mobile METRIC_CONFIG).
exports.STEPS_GOAL = 10_000;
exports.MAX_HABIT_LOG_DAYS = 30;
const MAX_HABIT_LOG_ENTRIES = 60;
const round1 = (n) => Math.round(n * 10) / 10;
/** Per-metric rounding: counts and bpm are whole numbers, HRV keeps one decimal. */
function roundMetric(metric, value) {
    return metric === 'HRV' ? round1(value) : Math.round(value);
}
function formatSteps(steps) {
    return Math.round(steps).toLocaleString('en-US');
}
function formatDuration(minutes) {
    const m = Math.round(minutes);
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function display(metric, value) {
    switch (metric) {
        case 'STEPS':
            return `${formatSteps(value)} steps`;
        case 'RESTING_HR':
            return `${Math.round(value)} bpm`;
        case 'HRV':
            return `${round1(value)} ms`;
        case 'SLEEP':
            return formatDuration(value);
    }
}
const percentOf = (value, goal) => (goal > 0 ? Math.round((value / goal) * 100) : null);
const percentDisplay = (pct) => (pct === null ? null : `${pct}%`);
/**
 * The day-over-day change as a phrase, so the model never has to combine a
 * signed delta with a direction word (which produced "-145 less").
 */
function describeChange(metric, delta) {
    if (delta === null)
        return null;
    if (delta === 0)
        return 'the same as the day before';
    const size = Math.abs(delta);
    switch (metric) {
        case 'STEPS':
            return `${formatSteps(size)} ${delta > 0 ? 'more' : 'fewer'} steps than the day before`;
        case 'SLEEP':
            return `${formatDuration(size)} ${delta > 0 ? 'more' : 'less'} than the night before`;
        case 'RESTING_HR':
            return `${Math.round(size)} bpm ${delta > 0 ? 'higher' : 'lower'} than the day before`;
        case 'HRV':
            return `${round1(size)} ms ${delta > 0 ? 'higher' : 'lower'} than the day before`;
    }
}
async function valuesOn(userId, date) {
    const rows = await client_1.prisma.biometricRecord.findMany({
        where: { userId, recordedAt: (0, civilDate_1.civilDateToUtcMidnight)(date) },
        select: { metricType: true, value: true },
    });
    const out = {};
    for (const r of rows)
        out[r.metricType] = r.value;
    return out;
}
function metricOfDay(metric, today, yesterday) {
    const t = today === undefined ? null : roundMetric(metric, today);
    const y = yesterday === undefined ? null : roundMetric(metric, yesterday);
    const { delta, direction } = (0, dailyScore_1.compareScores)(t, y);
    const rounded = delta === null ? null : roundMetric(metric, delta);
    return {
        value: t,
        display: t === null ? null : display(metric, t),
        deltaFromYesterday: rounded,
        direction,
        changeDisplay: describeChange(metric, rounded),
    };
}
/** One day's raw metrics (null when not recorded), each compared with the day before. */
async function getDailyMetrics(userId, date) {
    const [today, yesterday, sleepGoalMinutes] = await Promise.all([
        valuesOn(userId, date),
        valuesOn(userId, (0, dates_1.shiftDate)(date, -1)),
        (0, goals_1.getSleepGoalMinutes)(userId),
    ]);
    const steps = metricOfDay('STEPS', today.STEPS, yesterday.STEPS);
    const sleep = metricOfDay('SLEEP', today.SLEEP, yesterday.SLEEP);
    const stepsPct = steps.value === null ? null : percentOf(steps.value, exports.STEPS_GOAL);
    const sleepPct = sleep.value === null ? null : percentOf(sleep.value, sleepGoalMinutes);
    return {
        date,
        steps: {
            ...steps,
            goal: exports.STEPS_GOAL,
            percentOfGoal: stepsPct,
            percentOfGoalDisplay: percentDisplay(stepsPct),
            goalMet: steps.value === null ? null : steps.value >= exports.STEPS_GOAL,
        },
        restingHeartRate: metricOfDay('RESTING_HR', today.RESTING_HR, yesterday.RESTING_HR),
        hrv: metricOfDay('HRV', today.HRV, yesterday.HRV),
        sleep: {
            ...sleep,
            goalMinutes: sleepGoalMinutes,
            goalDisplay: formatDuration(sleepGoalMinutes),
            percentOfGoal: sleepPct,
            percentOfGoalDisplay: percentDisplay(sleepPct),
        },
    };
}
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateLabel(date) {
    return `${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}
function describeTrend(trend, pct) {
    if (trend === null || pct === null)
        return null;
    if (trend === 'steady')
        return 'steady';
    return `${trend} ${Math.abs(pct)}%`;
}
// Within this many percent the halves are "steady", the same band the app's own insights use.
const STEADY_PERCENT = 3;
/**
 * Compares the average of the second half of the readings with the first
 * half, so one noisy day at either end cannot flip the answer. The model gets
 * this as a field instead of eyeballing the points (the spike found models
 * claiming trends the data did not support).
 */
function computeTrend(values) {
    if (values.length < 2)
        return { trend: null, trendPercent: null };
    const mid = Math.floor(values.length / 2);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const first = mean(values.slice(0, mid));
    const second = mean(values.slice(values.length - mid));
    if (first === 0)
        return { trend: null, trendPercent: null };
    const pct = Math.round(((second - first) / Math.abs(first)) * 100);
    return { trend: Math.abs(pct) < STEADY_PERCENT ? 'steady' : pct > 0 ? 'up' : 'down', trendPercent: pct };
}
/** The last N days (ending today) of one metric, oldest first, with precomputed summary values. */
async function getMetricHistory(userId, metric, days, today) {
    const rows = await client_1.prisma.biometricRecord.findMany({
        where: {
            userId,
            metricType: metric,
            recordedAt: { gte: (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(today, -(days - 1))), lte: (0, civilDate_1.civilDateToUtcMidnight)(today) },
        },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, value: true },
    });
    const points = rows.map((r) => {
        const value = roundMetric(metric, r.value);
        const date = r.recordedAt.toISOString().slice(0, 10);
        return { date, dateLabel: dateLabel(date), value, display: display(metric, value) };
    });
    const values = points.map((p) => p.value);
    const avg = values.length ? roundMetric(metric, values.reduce((a, b) => a + b, 0) / values.length) : null;
    const pick = (better) => points.length ? points.reduce((best, p) => (better(p.value, best.value) ? p : best)) : null;
    const trend = computeTrend(values);
    const result = {
        metric,
        days,
        daysWithData: points.length,
        points,
        average: avg,
        averageDisplay: avg === null ? null : display(metric, avg),
        highest: pick((a, b) => a > b),
        lowest: pick((a, b) => a < b),
        earliest: points[0] ?? null,
        latest: points[points.length - 1] ?? null,
        ...trend,
        trendDisplay: describeTrend(trend.trend, trend.trendPercent),
        coverageDisplay: `${points.length} of ${days}`,
    };
    if (metric === 'STEPS') {
        result.daysAtGoal = values.filter((v) => v >= exports.STEPS_GOAL).length;
        result.daysAtGoalDisplay = `${result.daysAtGoal} of ${days}`;
    }
    return result;
}
/**
 * What the user logged over the last N days: a per-habit summary plus the
 * individual entries (newest first, capped). Free-text notes are never
 * included: they are the user's words, not data, and could carry anything.
 */
async function getHabitLogs(userId, days, today) {
    const from = (0, dates_1.shiftDate)(today, -(days - 1));
    const range = { gte: (0, civilDate_1.civilDateToUtcMidnight)(from), lte: (0, civilDate_1.civilDateToUtcMidnight)(today) };
    const [logs, checkIns, types] = await Promise.all([
        client_1.prisma.habitLog.findMany({
            where: { userId, habitDay: range },
            orderBy: [{ habitDay: 'desc' }, { loggedAt: 'desc' }],
            select: { habitType: true, value: true, unit: true, habitDay: true },
        }),
        client_1.prisma.habitCheckIn.count({ where: { userId, habitDay: range } }),
        (0, habitTypes_1.listHabitTypes)(userId),
    ]);
    const labelOf = new Map(types.map((t) => [t.type, t.label]));
    const byType = new Map();
    for (const l of logs) {
        const day = l.habitDay.toISOString().slice(0, 10);
        const agg = byType.get(l.habitType) ?? { unit: l.unit, days: new Set(), noneDays: new Set(), total: 0 };
        agg.days.add(day);
        if (l.value === 0)
            agg.noneDays.add(day);
        agg.total += l.value;
        byType.set(l.habitType, agg);
    }
    return {
        days,
        from,
        to: today,
        checkedInDays: checkIns,
        habits: [...byType.entries()].map(([habitType, a]) => ({
            habitType,
            habitLabel: labelOf.get(habitType) ?? habitType,
            unit: a.unit,
            daysLogged: a.days.size,
            total: round1(a.total),
            daysWithNone: a.noneDays.size,
        })),
        entries: logs.slice(0, MAX_HABIT_LOG_ENTRIES).map((l) => ({
            date: l.habitDay.toISOString().slice(0, 10),
            habitLabel: labelOf.get(l.habitType) ?? l.habitType,
            value: round1(l.value),
            unit: l.unit,
        })),
        entriesTruncated: logs.length > MAX_HABIT_LOG_ENTRIES,
    };
}
//# sourceMappingURL=metrics.js.map