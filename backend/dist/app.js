"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const routes_1 = require("./auth/routes");
const routes_2 = require("./health/routes");
const routes_3 = require("./biometrics/routes");
const routes_4 = require("./users/routes");
const routes_5 = require("./scoring/routes");
const routes_6 = require("./habits/routes");
const routes_7 = require("./coach/routes");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.get('/health-check', (_req, res) => res.json({ status: 'ok' })); // renamed from /health to avoid clashing with the new /health/* route prefix
    app.use(routes_1.authRouter);
    app.use(routes_2.healthRouter);
    app.use(routes_3.biometricsRouter);
    app.use(routes_4.usersRouter);
    app.use(routes_5.scoresRouter);
    app.use(routes_6.habitsRouter);
    app.use(routes_7.coachRouter);
    return app;
}
//# sourceMappingURL=app.js.map