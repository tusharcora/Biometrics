"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SCORE_DAYS = exports.DEFAULT_SCORE_DAYS = exports.scoresRouter = void 0;
const express_1 = require("express");
const middleware_1 = require("../auth/middleware");
const civilDate_1 = require("../biometrics/civilDate");
const client_1 = require("../db/client");
const configs_1 = require("./configs");
const dates_1 = require("./dates");
const dto_1 = require("./dto");
exports.scoresRouter = (0, express_1.Router)();
exports.DEFAULT_SCORE_DAYS = 30;
exports.MAX_SCORE_DAYS = 120;
function parseType(raw) {
    return raw === 'RECOVERY' || raw === 'SLEEP' ? raw : null;
}
/** Newest first, over the last `days` local days (default 30, capped at 120). */
exports.scoresRouter.get('/me/scores', middleware_1.requireAuth, async (req, res) => {
    let days = exports.DEFAULT_SCORE_DAYS;
    if (req.query.days !== undefined) {
        days = Number(req.query.days);
        if (!Number.isInteger(days) || days < 1) {
            res.status(400).json({ error: 'days must be a positive integer' });
            return;
        }
        days = Math.min(days, exports.MAX_SCORE_DAYS);
    }
    // Optional filter: absent means both score types.
    const type = req.query.type === undefined ? undefined : parseType(req.query.type);
    if (type === null) {
        res.status(400).json({ error: 'type must be RECOVERY or SLEEP' });
        return;
    }
    const user = await client_1.prisma.user.findUnique({ where: { id: req.userId }, select: { timezone: true } });
    // "Today" is the user's local day, so the window lines up with the civil
    // dates the scores are keyed on.
    const today = (0, civilDate_1.localCivilDate)(new Date(), user?.timezone ?? 'UTC');
    const since = (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(today, -(days - 1)));
    const rows = await client_1.prisma.dailyScore.findMany({
        where: { userId: req.userId, ...(type ? { type } : {}), date: { gte: since } },
        // Same-day rows: RECOVERY before SLEEP (enum declaration order).
        orderBy: [{ date: 'desc' }, { type: 'asc' }],
    });
    const snapshots = await client_1.prisma.baselineSnapshot.findMany({
        where: { userId: req.userId, date: { gte: since }, metric: { in: dto_1.BASELINE_METRICS } },
    });
    res.json({
        scores: rows.map((row) => (0, dto_1.toDailyScoreDTO)(row, snapshots.filter((s) => s.date.getTime() === row.date.getTime()))),
        bands: (0, configs_1.getLiveConfig)().scoreBands,
    });
});
exports.scoresRouter.get('/me/scores/:date', middleware_1.requireAuth, async (req, res) => {
    const date = req.params.date;
    if (!(0, dates_1.isCivilDate)(date)) {
        res.status(400).json({ error: 'date must be a valid YYYY-MM-DD' });
        return;
    }
    const type = req.query.type === undefined ? 'RECOVERY' : parseType(req.query.type);
    if (!type) {
        res.status(400).json({ error: 'type must be RECOVERY or SLEEP' });
        return;
    }
    const userId = req.userId;
    const day = (0, civilDate_1.civilDateToUtcMidnight)(date);
    const row = await client_1.prisma.dailyScore.findUnique({ where: { userId_date_type: { userId, date: day, type } } });
    if (!row) {
        res.status(404).json({ error: `No ${type} score for ${date}` });
        return;
    }
    const snapshots = await client_1.prisma.baselineSnapshot.findMany({
        where: { userId, date: day, metric: { in: dto_1.BASELINE_METRICS } },
    });
    // The last day with an actual score (a cold-start day has none), so the
    // client can show "+4 vs yesterday" without a second round trip.
    const prev = await client_1.prisma.dailyScore.findFirst({
        where: { userId, type, date: { lt: day }, score: { not: null } },
        orderBy: { date: 'desc' },
    });
    res.json({
        score: (0, dto_1.toDailyScoreDTO)(row, snapshots),
        baselines: (0, dto_1.toBaselineDTOs)(snapshots, type),
        previous: prev && prev.score !== null ? { date: prev.date.toISOString().slice(0, 10), score: Math.round(prev.score * 10) / 10 } : null,
        bands: (0, configs_1.getLiveConfig)().scoreBands,
    });
});
//# sourceMappingURL=routes.js.map