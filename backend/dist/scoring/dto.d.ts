import type { BaselineSnapshot, DailyScore } from '@prisma/client';
import type { ConfidenceLevel, FactorKey } from './types';
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
export declare const FACTOR_LABELS: Record<FactorKey, string>;
/** Which baseline series backs each factor; also the `metric` id used in cold-start and baseline DTOs. */
export declare const FACTOR_METRIC: Record<FactorKey, string>;
export declare function toDailyScoreDTO(row: DailyScore, snapshotsForDate: BaselineSnapshot[]): DailyScoreDTO;
/** Baselines a score of `type` was computed against: only factor series that are past cold-start. */
export declare function toBaselineDTOs(snapshots: BaselineSnapshot[], type?: ScoreType): BaselineDTO[];
export declare const BASELINE_METRICS: string[];
//# sourceMappingURL=dto.d.ts.map