import type { ScoreConfig } from './v1';
import { v1Config } from './v1';

/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export const SCORE_CONFIGS: Record<string, ScoreConfig> = {
  [v1Config.version]: v1Config,
};

/** The version new scores are computed with. Rollout is: run the backtest, read the diff, flip this, deploy. */
export const LIVE_VERSION = 'v1';

export function getScoreConfig(version: string): ScoreConfig {
  const config = SCORE_CONFIGS[version];
  if (!config) {
    throw new Error(`Unknown score algorithm version "${version}". Known: ${Object.keys(SCORE_CONFIGS).join(', ')}`);
  }
  return config;
}

export function getLiveConfig(): ScoreConfig {
  return getScoreConfig(LIVE_VERSION);
}

export type { ScoreConfig };
