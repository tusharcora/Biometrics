import type { BaselineSnapshot, DailyScore } from '@prisma/client';
import { LIVE_VERSION, SCORE_CONFIGS } from './configs';
import type { ScoreConfig } from './configs/v1';
import type { ConfidenceLevel, FactorKey } from './types';

// The wire contract the mobile client codes against. Field names are fixed.

export type ScoreType = 'RECOVERY' | 'SLEEP';

export interface FactorDTO {
  factor: FactorKey;
  label: string;
  z: number | null;
  weight: number;
  contribution: number;
  points: number;
  imputed: boolean;
  excluded: boolean;
}

export interface ColdStartDTO {
  metric: string;
  daysCollected: number;
  daysRequired: number;
}

export interface DailyScoreDTO {
  date: string;
  type: ScoreType;
  score: number | null;
  confidenceLevel: ConfidenceLevel;
  algorithmVersion: string;
  factors: FactorDTO[];
  coldStart: ColdStartDTO[];
}

export interface BaselineDTO {
  metric: string;
  ewma: number;
  spread: number;
  daysOfHistory: number;
  windowDays: number;
  unit: string;
}

// RESTING_HR is Google's daily-minimum BPM, not a detected resting heart rate,
// so the honest label is "Daily minimum HR" (spec §2 Stage 4).
export const FACTOR_LABELS: Record<FactorKey, string> = {
  HRV: 'HRV',
  RHR: 'Daily minimum HR',
  SLEEP_DEBT: 'Sleep debt',
};

/** Which baseline series backs each factor; also the `metric` id used in cold-start and baseline DTOs. */
export const FACTOR_METRIC: Record<FactorKey, string> = {
  HRV: 'HRV',
  RHR: 'RESTING_HR',
  SLEEP_DEBT: 'SLEEP_DEBT',
};

const METRIC_UNITS: Record<string, string> = {
  HRV: 'ms',
  RESTING_HR: 'bpm',
  SLEEP_DEBT: 'min',
};

const FACTOR_ORDER: FactorKey[] = ['HRV', 'RHR', 'SLEEP_DEBT'];

const round = (n: number, places: number) => {
  const p = 10 ** places;
  return Math.round(n * p) / p;
};
const roundOrNull = (n: number | null, places: number) => (n === null ? null : round(n, places));

/** The config a stored row was computed with; falls back to the live one for an unknown version. */
function configFor(version: string): ScoreConfig {
  return SCORE_CONFIGS[version] ?? SCORE_CONFIGS[LIVE_VERSION]!;
}

interface StoredFactor {
  factor: FactorKey;
  z: number | null;
  weight: number;
  contribution: number;
  points?: number;
  imputed: boolean;
  excluded: boolean;
}

export function toDailyScoreDTO(row: DailyScore, snapshotsForDate: BaselineSnapshot[]): DailyScoreDTO {
  const cfg = configFor(row.algorithmVersion);
  const stored = row.factors as unknown as StoredFactor[];

  const factors: FactorDTO[] = stored.map((f) => ({
    factor: f.factor,
    label: FACTOR_LABELS[f.factor],
    z: roundOrNull(f.z, 2),
    weight: round(f.weight, 3),
    contribution: round(f.contribution, 3),
    points: round(f.points ?? 0, 2),
    imputed: f.imputed,
    excluded: f.excluded,
  }));

  const coldStart: ColdStartDTO[] = FACTOR_ORDER.filter((k) => stored.find((f) => f.factor === k)?.excluded).map(
    (k) => ({
      metric: FACTOR_METRIC[k],
      daysCollected: snapshotsForDate.find((s) => s.metric === FACTOR_METRIC[k])?.daysOfHistory ?? 0,
      daysRequired: cfg.minHistoryDays,
    }),
  );

  return {
    date: row.date.toISOString().slice(0, 10),
    type: row.type,
    score: roundOrNull(row.score, 1),
    confidenceLevel: row.confidenceLevel,
    algorithmVersion: row.algorithmVersion,
    factors,
    coldStart,
  };
}

/** Baselines a score was computed against: only factor series that are past cold-start. */
export function toBaselineDTOs(snapshots: BaselineSnapshot[]): BaselineDTO[] {
  const out: BaselineDTO[] = [];
  for (const key of FACTOR_ORDER) {
    const snap = snapshots.find((s) => s.metric === FACTOR_METRIC[key]);
    if (!snap || snap.ewma === null || snap.spread === null) continue;
    out.push({
      metric: snap.metric,
      ewma: round(snap.ewma, 2),
      spread: round(snap.spread, 2),
      daysOfHistory: snap.daysOfHistory,
      windowDays: configFor(snap.algorithmVersion).ewmaN,
      unit: METRIC_UNITS[snap.metric] ?? '',
    });
  }
  return out;
}

export const BASELINE_METRICS = Object.values(FACTOR_METRIC);
