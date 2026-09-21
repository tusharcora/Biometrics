import { apiFetch } from './client';

export type ScoreType = 'RECOVERY' | 'SLEEP';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// One weighted term of a score -- the addends of the Stage 4 sum (see the Stat
// Engine spec). `label` comes from the server and is rendered as given; the
// RHR factor's label is a daily-minimum proxy, not a clinical resting HR.
// The Sleep Score's factors are SLEEP_DURATION (scored against the user's
// sleep goal), SLEEP_EFFICIENCY and CIRCADIAN_CONSISTENCY ("Bedtime
// consistency"); circadian needs ~27 nights, so a Sleep Score with fewer
// factors is normal.
export type FactorKey =
  | 'HRV'
  | 'RHR'
  | 'SLEEP_DEBT'
  | 'SLEEP_DURATION'
  | 'SLEEP_EFFICIENCY'
  | 'CIRCADIAN_CONSISTENCY';

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

// metric is one of HRV | RESTING_HR | SLEEP (the sleep-duration factor) |
// SLEEP_EFFICIENCY | CIRCADIAN_CONSISTENCY | SLEEP_DEBT.
export interface ColdStartDTO {
  metric: string;
  daysCollected: number;
  daysRequired: number;
}

export interface DailyScoreDTO {
  date: string; // YYYY-MM-DD
  type: ScoreType;
  // null when every factor is excluded (all metrics still cold-starting).
  score: number | null;
  confidenceLevel: ConfidenceLevel;
  algorithmVersion: string;
  factors: FactorDTO[];
  coldStart: ColdStartDTO[];
}

// unit is 'ms' | 'bpm' | 'min' for the raw metrics, '%' for SLEEP_EFFICIENCY
// and 'pts' for CIRCADIAN_CONSISTENCY.
export interface BaselineDTO {
  metric: string;
  ewma: number;
  spread: number;
  daysOfHistory: number;
  windowDays: number;
  unit: string;
}

export interface ScoreDetailDTO {
  score: DailyScoreDTO;
  baselines: BaselineDTO[];
  previous: { date: string; score: number } | null;
}

// Newest first. Without `type` the server returns BOTH score types
// (RECOVERY first within a day).
export async function fetchScores(days: number, type?: ScoreType): Promise<DailyScoreDTO[]> {
  const query = type ? `days=${days}&type=${type}` : `days=${days}`;
  const res = await apiFetch<{ scores?: DailyScoreDTO[] }>(`/me/scores?${query}`);
  return res?.scores ?? [];
}

// null when the server has no score for that day (404); any other failure throws.
export async function fetchScoreDetail(date: string, type: ScoreType = 'RECOVERY'): Promise<ScoreDetailDTO | null> {
  try {
    return await apiFetch<ScoreDetailDTO>(`/me/scores/${date}?type=${type}`);
  } catch (error) {
    if ((error as { status?: number } | null)?.status === 404) return null;
    throw error;
  }
}
