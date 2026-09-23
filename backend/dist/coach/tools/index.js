"use strict";
// The coach's tool registry (spec section 2): thin READ-ONLY wrappers over the
// Stat Engine, the user's daily metrics, habit logs and correlation tables. No
// tool writes, none takes SQL, and none returns a pre-composed sentence or a
// free-text note: every value the model may state arrives as a structured
// field it references with {{tool.path}}. (Raw metrics and habit logs were
// added with consent version 2, whose text lists them.)
Object.defineProperty(exports, "__esModule", { value: true });
exports.coachTools = exports.PROPOSE_MEMORY_SCHEMA = exports.COACH_TOOL_SCHEMAS = exports.MAX_HISTORY_DAYS = void 0;
exports.getScoreHistory = getScoreHistory;
exports.getHabitCorrelations = getHabitCorrelations;
exports.getUserGoals = getUserGoals;
const civilDate_1 = require("../../biometrics/civilDate");
const client_1 = require("../../db/client");
const correlations_1 = require("../../habits/correlations");
const habitTypes_1 = require("../../habits/habitTypes");
const dates_1 = require("../../scoring/dates");
const goals_1 = require("../../users/goals");
const memory_1 = require("../memory");
const dailyScore_1 = require("./dailyScore");
const metrics_1 = require("./metrics");
exports.MAX_HISTORY_DAYS = 90;
const HISTORY_METRICS = ['RECOVERY', 'SLEEP'];
exports.COACH_TOOL_SCHEMAS = [
    {
        name: 'getDailyScore',
        description: "The user's Recovery Score and Sleep Score for one local date, their per-factor breakdown, a confidence level, and " +
            'the change from the day before (deltaFromYesterday, direction: higher | lower | unchanged, and changeDisplay / ' +
            'sleepChangeDisplay as full phrases such as "4 points lower than yesterday"), all precomputed. ' +
            "Today's result is already available this turn.",
        parameters: {
            type: 'object',
            properties: { date: { type: 'string', description: 'Civil date, YYYY-MM-DD. Defaults to today.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'getScoreHistory',
        description: 'Daily scores over the last N days, oldest first, with the precomputed average, highest and lowest.',
        parameters: {
            type: 'object',
            properties: {
                metric: { type: 'string', enum: [...HISTORY_METRICS] },
                days: { type: 'integer', minimum: 1, maximum: exports.MAX_HISTORY_DAYS },
            },
            required: ['metric', 'days'],
            additionalProperties: false,
        },
    },
    {
        name: 'getHabitCorrelations',
        description: "The user's statistically confirmed habit patterns only, each as structured fields (habitType, habitLabel, " +
            'exposureThreshold, exposureUnit, factor, lagDays, effectSizePercent, comparisonPercent, sampleSize, direction). ' +
            'Never raw habit logs.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getUserGoals',
        description: "The user's goals, currently the sleep goal, from the same source the sleep-debt score uses.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getTodayMetrics',
        description: "Today's raw readings, in the same shape as getDailyMetrics. Already fetched for you every turn; reference it " +
            'directly, e.g. {{getTodayMetrics.steps.display}}.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getDailyMetrics',
        description: "The user's raw readings for one local date other than today (today's are in getTodayMetrics): steps (with goal, " +
            'percentOfGoal, goalMet), restingHeartRate (bpm), ' +
            'hrv (ms) and sleep (minutes asleep, with goalMinutes and percentOfGoal). Each has value, a ready-to-read display ' +
            'string, deltaFromYesterday, direction (higher | lower | unchanged) and changeDisplay (the change as a full phrase, ' +
            'e.g. "2h 25m less than the night before"), all precomputed; a value is null when that ' +
            'day was not recorded. Use this for questions about steps, heart rate, HRV or how long they slept.',
        parameters: {
            type: 'object',
            properties: { date: { type: 'string', description: 'Civil date, YYYY-MM-DD. Defaults to today.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'getMetricHistory',
        description: 'One raw metric (STEPS, RESTING_HR, HRV or SLEEP minutes) over the last N days, oldest first: points with display ' +
            'strings, days, daysWithData, and the precomputed average/averageDisplay, highest, lowest, earliest and latest ' +
            '(each with date, dateLabel such as "Sep 21", value, display), trend (up | down | steady, second-half vs ' +
            'first-half average) with trendPercent and trendDisplay ("down 8%"); STEPS also has daysAtGoal. Use it for any question about a trend, a week, a month or "how many days".',
        parameters: {
            type: 'object',
            properties: {
                metric: { type: 'string', enum: [...metrics_1.METRIC_KEYS] },
                days: { type: 'integer', minimum: 1, maximum: exports.MAX_HISTORY_DAYS },
            },
            required: ['metric', 'days'],
            additionalProperties: false,
        },
    },
    {
        name: 'getHabitLogs',
        description: 'What the user logged (alcohol, caffeine, workouts, custom habits) over the last N days: a per-habit summary ' +
            '(daysLogged, total, daysWithNone) and the individual entries, newest first, plus checkedInDays.',
        parameters: {
            type: 'object',
            properties: { days: { type: 'integer', minimum: 1, maximum: metrics_1.MAX_HABIT_LOG_DAYS } },
            required: ['days'],
            additionalProperties: false,
        },
    },
];
/**
 * The one tool that is not read-only, and it is still not a writer: proposeMemory
 * only VALIDATES the proposal (closed category enum, <= 140 chars, health-fact
 * classifier) and hands it back. The orchestrator persists it as PENDING only
 * after the whole reply has passed the grounding guardrail, so a discarded or
 * timed-out turn never leaves a row behind. Kept out of COACH_TOOL_SCHEMAS
 * (the read-only registry the spec lists) and added to what the model sees below.
 */
exports.PROPOSE_MEMORY_SCHEMA = {
    name: 'proposeMemory',
    description: 'Propose remembering ONE stable training goal, schedule or preference the user stated about themselves. ' +
        'Never health, medical, medication, injury or body facts: those are rejected and never stored. ' +
        'The user is told and can correct it.',
    parameters: {
        type: 'object',
        properties: {
            category: { type: 'string', enum: [...memory_1.MEMORY_CATEGORIES] },
            value: { type: 'string', maxLength: memory_1.MAX_MEMORY_VALUE_CHARS },
        },
        required: ['category', 'value'],
        additionalProperties: false,
    },
};
const round1 = (n) => Math.round(n * 10) / 10;
const isPositiveInt = (n) => typeof n === 'number' && Number.isInteger(n) && n >= 1;
function asRecord(args) {
    if (args === undefined || args === null)
        return {};
    return typeof args === 'object' && !Array.isArray(args) ? args : null;
}
async function getScoreHistory(userId, metric, days, today) {
    const rows = await client_1.prisma.dailyScore.findMany({
        where: {
            userId,
            type: metric,
            score: { not: null },
            date: { gte: (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(today, -(days - 1))), lte: (0, civilDate_1.civilDateToUtcMidnight)(today) },
        },
        orderBy: { date: 'asc' },
    });
    const points = rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), score: round1(r.score) }));
    const scores = points.map((p) => p.score);
    return {
        metric,
        days,
        points,
        average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        highest: scores.length ? Math.max(...scores) : null,
        lowest: scores.length ? Math.min(...scores) : null,
    };
}
async function getHabitCorrelations(userId) {
    const [confirmed, types] = await Promise.all([(0, correlations_1.getConfirmedCorrelations)(userId), (0, habitTypes_1.listHabitTypes)(userId)]);
    const labelOf = new Map(types.map((t) => [t.type, t.label]));
    return {
        correlations: confirmed.map((c) => ({
            habitType: c.habitType,
            habitLabel: labelOf.get(c.habitType) ?? c.habitType,
            exposureThreshold: c.exposureThreshold,
            exposureUnit: c.exposureUnit,
            factor: c.factor,
            lagDays: c.lagDays,
            effectSizePercent: c.effectSizePercent,
            comparisonPercent: c.comparisonPercent,
            sampleSize: c.sampleSize,
            direction: c.direction,
        })),
    };
}
async function getUserGoals(userId) {
    const sleepGoalMinutes = await (0, goals_1.getSleepGoalMinutes)(userId);
    return { sleepGoalMinutes, sleepGoalHours: round1(sleepGoalMinutes / 60) };
}
exports.coachTools = {
    schemas: [...exports.COACH_TOOL_SCHEMAS, exports.PROPOSE_MEMORY_SCHEMA],
    async run(userId, name, args, ctx) {
        const a = asRecord(args);
        if (a === null)
            return { ok: false, error: 'invalid_arguments' };
        switch (name) {
            case 'proposeMemory': {
                const checked = (0, memory_1.validateMemoryInput)(a);
                if (checked.ok) {
                    const result = { proposal: { category: checked.category, value: checked.value } };
                    return { ok: true, result };
                }
                // A health-shaped value is reported as rejected; a malformed call as invalid arguments.
                return { ok: false, error: checked.reason === 'health_content' ? 'memory_rejected' : 'invalid_arguments' };
            }
            case 'getDailyScore': {
                const date = a.date === undefined ? ctx.today : a.date;
                if (!(0, dates_1.isCivilDate)(date))
                    return { ok: false, error: 'invalid_arguments' };
                return { ok: true, result: await (0, dailyScore_1.getDailyScore)(userId, date) };
            }
            case 'getScoreHistory': {
                const metric = a.metric;
                const days = a.days;
                if (!HISTORY_METRICS.includes(metric))
                    return { ok: false, error: 'invalid_arguments' };
                if (typeof days !== 'number' || !Number.isInteger(days) || days < 1)
                    return { ok: false, error: 'invalid_arguments' };
                return {
                    ok: true,
                    result: await getScoreHistory(userId, metric, Math.min(days, exports.MAX_HISTORY_DAYS), ctx.today),
                };
            }
            case 'getHabitCorrelations':
                return { ok: true, result: await getHabitCorrelations(userId) };
            case 'getUserGoals':
                return { ok: true, result: await getUserGoals(userId) };
            case 'getTodayMetrics':
                return { ok: true, result: await (0, metrics_1.getDailyMetrics)(userId, ctx.today) };
            case 'getDailyMetrics': {
                const date = a.date === undefined ? ctx.today : a.date;
                if (!(0, dates_1.isCivilDate)(date))
                    return { ok: false, error: 'invalid_arguments' };
                return { ok: true, result: await (0, metrics_1.getDailyMetrics)(userId, date) };
            }
            case 'getMetricHistory': {
                const metric = a.metric;
                const days = a.days;
                if (!metrics_1.METRIC_KEYS.includes(metric))
                    return { ok: false, error: 'invalid_arguments' };
                if (!isPositiveInt(days))
                    return { ok: false, error: 'invalid_arguments' };
                return { ok: true, result: await (0, metrics_1.getMetricHistory)(userId, metric, Math.min(days, exports.MAX_HISTORY_DAYS), ctx.today) };
            }
            case 'getHabitLogs': {
                if (!isPositiveInt(a.days))
                    return { ok: false, error: 'invalid_arguments' };
                return { ok: true, result: await (0, metrics_1.getHabitLogs)(userId, Math.min(a.days, metrics_1.MAX_HABIT_LOG_DAYS), ctx.today) };
            }
            default:
                return { ok: false, error: 'unknown_tool' };
        }
    },
    getDailyScore: dailyScore_1.getDailyScore,
    findMostRecentScoreDate: dailyScore_1.findMostRecentScoreDate,
    getDailyMetrics: metrics_1.getDailyMetrics,
};
//# sourceMappingURL=index.js.map