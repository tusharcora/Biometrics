"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LOG_RANGE_DAYS = exports.DEFAULT_LOG_RANGE_DAYS = exports.MAX_STATUS_DAYS = exports.DEFAULT_STATUS_DAYS = exports.habitsRouter = void 0;
const express_1 = require("express");
const middleware_1 = require("../auth/middleware");
const civilDate_1 = require("../biometrics/civilDate");
const client_1 = require("../db/client");
const dates_1 = require("../scoring/dates");
const dto_1 = require("../scoring/dto");
const analysis_1 = require("./analysis");
const config_1 = require("./config");
const correlations_1 = require("./correlations");
const engine_1 = require("./engine");
const habitDay_1 = require("./habitDay");
const habitTypes_1 = require("./habitTypes");
const observed_1 = require("./observed");
exports.habitsRouter = (0, express_1.Router)();
exports.DEFAULT_STATUS_DAYS = 14;
exports.MAX_STATUS_DAYS = 60;
exports.DEFAULT_LOG_RANGE_DAYS = 30;
exports.MAX_LOG_RANGE_DAYS = 366;
const MAX_LABEL_LENGTH = 40;
const MAX_UNIT_LENGTH = 20;
const MAX_NOTE_LENGTH = 500;
/** Client clocks drift; a log dated further ahead than this is a bug or garbage, not "later today". */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const isoDay = (d) => d.toISOString().slice(0, 10);
async function userTimezone(userId) {
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return user?.timezone ?? 'UTC';
}
function toHabitTypeDTO(t) {
    return { type: t.type, label: t.label, unit: t.unit, exposureThreshold: t.exposureThreshold, builtIn: t.builtIn };
}
function toLogDTO(log) {
    return {
        id: log.id,
        habitType: log.habitType,
        value: log.value,
        unit: log.unit,
        loggedAt: log.loggedAt.toISOString(),
        habitDay: isoDay(log.habitDay),
        note: log.note,
    };
}
exports.habitsRouter.get('/me/habits/config', middleware_1.requireAuth, async (req, res) => {
    const types = await (0, habitTypes_1.listHabitTypes)(req.userId);
    res.json({ habitTypes: types.map(toHabitTypeDTO) });
});
exports.habitsRouter.post('/me/habits/types', middleware_1.requireAuth, async (req, res) => {
    const { label: rawLabel, unit: rawUnit, exposureThreshold } = req.body ?? {};
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    const unit = typeof rawUnit === 'string' ? rawUnit.trim() : '';
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH) {
        res.status(400).json({ error: `label must be 1-${MAX_LABEL_LENGTH} characters` });
        return;
    }
    if (unit.length === 0 || unit.length > MAX_UNIT_LENGTH) {
        res.status(400).json({ error: `unit must be 1-${MAX_UNIT_LENGTH} characters` });
        return;
    }
    // > 0, not >= 0: a threshold of 0 would make every observed day "exposed".
    if (typeof exposureThreshold !== 'number' || !Number.isFinite(exposureThreshold) || exposureThreshold <= 0) {
        res.status(400).json({ error: 'exposureThreshold must be a positive number' });
        return;
    }
    const userId = req.userId;
    const existing = await (0, habitTypes_1.listHabitTypes)(userId);
    if (existing.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
        res.status(409).json({ error: `A habit named "${label}" already exists` });
        return;
    }
    const created = await client_1.prisma.habitType.create({
        data: { userId, type: (0, habitTypes_1.newCustomTypeId)(label), label, unit, exposureThreshold },
    });
    res.status(201).json({
        habitType: toHabitTypeDTO({
            type: created.type,
            label: created.label,
            unit: created.unit,
            exposureThreshold: created.exposureThreshold,
            builtIn: false,
        }),
    });
});
exports.habitsRouter.post('/me/habits/logs', middleware_1.requireAuth, async (req, res) => {
    const { habitType, value, unit, note, loggedAt: rawLoggedAt } = req.body ?? {};
    const userId = req.userId;
    if (typeof habitType !== 'string') {
        res.status(400).json({ error: 'habitType is required' });
        return;
    }
    const type = (await (0, habitTypes_1.listHabitTypes)(userId)).find((t) => t.type === habitType);
    if (!type) {
        res.status(400).json({ error: `Unknown habit type "${habitType}"` });
        return;
    }
    // 0 is valid and meaningful ("none"); negative, NaN and Infinity are not.
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        res.status(400).json({ error: 'value must be a finite number >= 0' });
        return;
    }
    if (unit !== undefined && (typeof unit !== 'string' || unit.trim().length === 0 || unit.length > MAX_UNIT_LENGTH)) {
        res.status(400).json({ error: `unit must be a non-empty string of at most ${MAX_UNIT_LENGTH} characters` });
        return;
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH)) {
        res.status(400).json({ error: `note must be a string of at most ${MAX_NOTE_LENGTH} characters` });
        return;
    }
    const now = new Date();
    let loggedAt = now;
    if (rawLoggedAt !== undefined) {
        loggedAt = new Date(rawLoggedAt);
        if (typeof rawLoggedAt !== 'string' || Number.isNaN(loggedAt.getTime())) {
            res.status(400).json({ error: 'loggedAt must be an ISO timestamp' });
            return;
        }
        if (loggedAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
            res.status(400).json({ error: 'loggedAt cannot be in the future' });
            return;
        }
    }
    // Derived once, with the timezone in effect NOW, and stored: a later change
    // to User.timezone must not move old logs to different habit days.
    const habitDay = (0, habitDay_1.habitDayFor)(loggedAt, await userTimezone(userId));
    const log = await client_1.prisma.habitLog.create({
        data: {
            userId,
            habitType,
            value,
            unit: typeof unit === 'string' ? unit.trim() : type.unit,
            loggedAt,
            habitDay: (0, civilDate_1.civilDateToUtcMidnight)(habitDay),
            note: typeof note === 'string' && note.length > 0 ? note : null,
        },
    });
    res.status(201).json({ log: toLogDTO(log) });
});
exports.habitsRouter.get('/me/habits/logs', middleware_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const { from: rawFrom, to: rawTo } = req.query;
    if ((rawFrom !== undefined && !(0, dates_1.isCivilDate)(rawFrom)) || (rawTo !== undefined && !(0, dates_1.isCivilDate)(rawTo))) {
        res.status(400).json({ error: 'from and to must be valid YYYY-MM-DD habit days' });
        return;
    }
    const today = (0, habitDay_1.habitDayFor)(new Date(), await userTimezone(userId));
    const to = rawTo ?? today;
    const from = rawFrom ?? (0, dates_1.shiftDate)(to, -(exports.DEFAULT_LOG_RANGE_DAYS - 1));
    if (from > to) {
        res.status(400).json({ error: 'from must not be after to' });
        return;
    }
    if ((0, dates_1.shiftDate)(from, exports.MAX_LOG_RANGE_DAYS) < to) {
        res.status(400).json({ error: `range is limited to ${exports.MAX_LOG_RANGE_DAYS} days` });
        return;
    }
    const logs = await client_1.prisma.habitLog.findMany({
        where: { userId, habitDay: { gte: (0, civilDate_1.civilDateToUtcMidnight)(from), lte: (0, civilDate_1.civilDateToUtcMidnight)(to) } },
        orderBy: [{ habitDay: 'desc' }, { loggedAt: 'desc' }],
    });
    res.json({ logs: logs.map(toLogDTO) });
});
exports.habitsRouter.delete('/me/habits/logs/:id', middleware_1.requireAuth, async (req, res) => {
    // Scoped by userId in the same query, so another user's log id is
    // indistinguishable from a nonexistent one (404, never 403).
    const result = await client_1.prisma.habitLog.deleteMany({ where: { id: String(req.params.id), userId: req.userId } });
    if (result.count === 0) {
        res.status(404).json({ error: 'Habit log not found' });
        return;
    }
    res.status(204).end();
});
exports.habitsRouter.post('/me/habits/check-ins', middleware_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const today = (0, habitDay_1.habitDayFor)(new Date(), await userTimezone(userId));
    const requested = req.body?.habitDay;
    let habitDay = today;
    if (requested !== undefined) {
        if (!(0, dates_1.isCivilDate)(requested)) {
            res.status(400).json({ error: 'habitDay must be a valid YYYY-MM-DD' });
            return;
        }
        habitDay = requested;
    }
    // Today and the previous 7 habit days: far enough to catch up after a
    // missed evening, not so far that history can be rewritten wholesale (or
    // the future pre-declared as "nothing").
    if (habitDay > today || habitDay < (0, dates_1.shiftDate)(today, -config_1.CHECK_IN_BACKFILL_DAYS)) {
        res.status(400).json({ error: `habitDay must be today or within the previous ${config_1.CHECK_IN_BACKFILL_DAYS} days` });
        return;
    }
    const day = (0, civilDate_1.civilDateToUtcMidnight)(habitDay);
    // Idempotent: a second tap changes nothing.
    await client_1.prisma.habitCheckIn.upsert({
        where: { userId_habitDay: { userId, habitDay: day } },
        update: {},
        create: { userId, habitDay: day },
    });
    res.status(201).json({ checkIn: { habitDay } });
});
exports.habitsRouter.get('/me/habits/status', middleware_1.requireAuth, async (req, res) => {
    let days = exports.DEFAULT_STATUS_DAYS;
    if (req.query.days !== undefined) {
        days = Number(req.query.days);
        if (!Number.isInteger(days) || days < 1) {
            res.status(400).json({ error: 'days must be a positive integer' });
            return;
        }
        days = Math.min(days, exports.MAX_STATUS_DAYS);
    }
    const userId = req.userId;
    const today = (0, habitDay_1.habitDayFor)(new Date(), await userTimezone(userId));
    const oldest = (0, dates_1.shiftDate)(today, -(days - 1));
    const window = { gte: (0, civilDate_1.civilDateToUtcMidnight)(oldest), lte: (0, civilDate_1.civilDateToUtcMidnight)(today) };
    const [types, logs, checkIns] = await Promise.all([
        (0, habitTypes_1.listHabitTypes)(userId),
        client_1.prisma.habitLog.findMany({ where: { userId, habitDay: window }, select: { habitType: true, value: true, habitDay: true } }),
        client_1.prisma.habitCheckIn.findMany({ where: { userId, habitDay: window }, select: { habitDay: true } }),
    ]);
    const checkedIn = new Set(checkIns.map((c) => isoDay(c.habitDay)));
    const observed = (0, observed_1.buildObservedDays)(logs.map((l) => ({ habitType: l.habitType, value: l.value, habitDay: isoDay(l.habitDay) })), [...checkedIn], types);
    const observedSets = new Map([...observed].map(([type, list]) => [type, new Set(list.map((d) => d.day))]));
    const out = [];
    for (let i = 0; i < days; i++) {
        const habitDay = (0, dates_1.shiftDate)(today, -i);
        out.push({
            habitDay,
            checkedIn: checkedIn.has(habitDay),
            observed: Object.fromEntries(types.map((t) => [t.type, observedSets.get(t.type)?.has(habitDay) ?? false])),
        });
    }
    res.json({ today, days: out });
});
exports.habitsRouter.get('/me/habits/patterns', middleware_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    // Patterns are the stored CONFIRMED rows (weekly lifecycle); the "N of 8 needed" counts are the one
    // live part, computed by the pair-counting gate alone: no statistical test runs on a read.
    const [confirmed, notEnoughData] = await Promise.all([(0, correlations_1.listConfirmedWithSeries)(userId), (0, analysis_1.computeNotEnoughData)(userId, new Date())]);
    res.json({
        // CONFIRMED only: candidates are never shown.
        patterns: confirmed
            .filter((c) => engine_1.CORRELATION_FACTORS.includes(c.factor))
            .map((c) => ({
            habitType: c.habitType,
            exposureThreshold: c.exposureThreshold,
            exposureUnit: c.exposureUnit,
            factor: c.factor,
            factorLabel: dto_1.FACTOR_LABELS[c.factor],
            lagDays: c.lagDays,
            effectSizePercent: c.effectSizePercent,
            comparisonPercent: c.comparisonPercent,
            sampleSize: c.sampleSize,
            direction: c.direction,
            series: c.series,
        })),
        notEnoughData,
    });
});
//# sourceMappingURL=routes.js.map