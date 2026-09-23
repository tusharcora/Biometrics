import type { ScoreConfig } from './v1';
/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export declare const SCORE_CONFIGS: Record<string, ScoreConfig>;
/**
 * The version new scores are computed with. Rollout is: run the backtest, read the diff, flip this, deploy.
 * A stored DailyScore from any other version is stale: the nightly sweep and the compute job recompute it.
 */
export declare const LIVE_VERSION = "v3";
export declare function getScoreConfig(version: string): ScoreConfig;
export declare function getLiveConfig(): ScoreConfig;
export type { ScoreConfig };
//# sourceMappingURL=index.d.ts.map