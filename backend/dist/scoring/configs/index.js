"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_VERSION = exports.SCORE_CONFIGS = void 0;
exports.getScoreConfig = getScoreConfig;
exports.getLiveConfig = getLiveConfig;
const v1_1 = require("./v1");
const v2_1 = require("./v2");
const v3_1 = require("./v3");
/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
exports.SCORE_CONFIGS = {
    [v1_1.v1Config.version]: v1_1.v1Config,
    [v2_1.v2Config.version]: v2_1.v2Config,
    [v3_1.v3Config.version]: v3_1.v3Config,
};
/**
 * The version new scores are computed with. Rollout is: run the backtest, read the diff, flip this, deploy.
 * A stored DailyScore from any other version is stale: the nightly sweep and the compute job recompute it.
 */
exports.LIVE_VERSION = 'v3';
function getScoreConfig(version) {
    const config = exports.SCORE_CONFIGS[version];
    if (!config) {
        throw new Error(`Unknown score algorithm version "${version}". Known: ${Object.keys(exports.SCORE_CONFIGS).join(', ')}`);
    }
    return config;
}
function getLiveConfig() {
    return getScoreConfig(exports.LIVE_VERSION);
}
//# sourceMappingURL=index.js.map