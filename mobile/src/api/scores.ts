import { apiFetch } from './client';

export type ScoreType = 'RECOVERY' | 'SLEEP';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// One weighted term of a score -- the addends of the Stage 4 sum (see the Stat
// Engine spec). `label` comes from the server and is rendered as given; the
// RHR factor's label is a daily-minimum proxy, not a clinical resting HR.
export interface FactorDTO {
  factor: 'HRV' | 'RHR' | 'SLEEP_DEBT';
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
  date: string; // YYYY-MM-DD
  type: ScoreType;
  // null when every factor is excluded (all metrics still cold-starting).
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

export interface ScoreDetailDTO {
  score: DailyScoreDTO;
  baselines: BaselineDTO[];
  previous: { date: string; score: number } | null;
}

// Newest first.
export async function fetchScores(days: number): Promise<DailyScoreDTO[]> {
  const res = await apiFetch<{ scores?: DailyScoreDTO[] }>(`/me/scores?days=${days}`);
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
