"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.biometricsRouter = void 0;
const express_1 = require("express");
const middleware_1 = require("../auth/middleware");
const repository_1 = require("./repository");
const activity_1 = require("./activity");
const client_1 = require("../db/client");
exports.biometricsRouter = (0, express_1.Router)();
exports.biometricsRouter.get('/me/biometrics', middleware_1.requireAuth, async (req, res) => {
    res.json(await (0, repository_1.getBiometricsForUser)(req.userId));
});
/**
 * Daily steps for the activity heat map over a bounded civil-date range
 * (?from=YYYY-MM-DD&to=YYYY-MM-DD, both inclusive). Bounded because a year of
 * history is too much to pull through the unbounded /me/biometrics.
 */
exports.biometricsRouter.get('/me/activity', middleware_1.requireAuth, async (req, res) => {
    const range = (0, activity_1.parseActivityRange)(req.query.from, req.query.to);
    if ('error' in range) {
        res.status(400).json({ error: range.error });
        return;
    }
    res.json(await (0, activity_1.getActivityForUser)(req.userId, range));
});
/**
 * Lets the client tell "connected", "needs reconnecting" and "never connected"
 * apart. Without it a disconnected user's dashboard just freezes on stale data
 * with no explanation, and a returning connected user has no route past the
 * connect screen.
 */
exports.biometricsRouter.get('/me/connection', middleware_1.requireAuth, async (req, res) => {
    const conn = await client_1.prisma.healthConnection.findUnique({
        where: { userId: req.userId },
        select: { status: true, lastSyncedAt: true },
    });
    if (!conn) {
        res.json({ status: 'NOT_CONNECTED', lastSyncedAt: null });
        return;
    }
    res.json({
        status: conn.status,
        lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
    });
});
//# sourceMappingURL=routes.js.map