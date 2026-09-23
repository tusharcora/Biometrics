export type Direction = 'higher' | 'lower' | 'unchanged';
export interface DailyScoreToolFactor {
    type: 'RECOVERY' | 'SLEEP';
    factor: string;
    label: string;
    z: number | null;
    contribution: number;
    points: number;
    imputed: boolean;
    excluded: boolean;
}
export interface DailyScoreToolResult {
    date: string;
    recoveryScore: number | null;
    sleepScore: number | null;
    factors: DailyScoreToolFactor[];
    /**
     * The same factors keyed by their stable FactorKey (HRV, SLEEP_DURATION, ...).
     * References must use this, not factors[n]: the array is built by skipping a
     * score row that does not exist for the day, so a missing RECOVERY row slides
     * every SLEEP factor down an index and {{getDailyScore.factors[0].points}}
     * silently resolves to a different factor than the model meant. The keys are
     * disjoint across RECOVERY and SLEEP, so one flat map is unambiguous.
     */
    factorsByKey: Record<string, DailyScoreToolFactor>;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    deltaFromYesterday: number | null;
    direction: Direction | null;
    sleepDeltaFromYesterday: number | null;
    sleepDirection: Direction | null;
    /** The recovery change as one phrase ("4 points lower than yesterday"), so the model never writes "down -4". */
    changeDisplay: string | null;
    sleepChangeDisplay: string | null;
}
/** Pure: a score delta as a phrase; null when there is nothing to compare. */
export declare function describeScoreChange(delta: number | null): string | null;
/** Pure: the signed difference and its direction from two already-rounded scores. */
export declare function compareScores(today: number | null, yesterday: number | null): {
    delta: number | null;
    direction: Direction | null;
};
export declare function getDailyScore(userId: string, date: string): Promise<DailyScoreToolResult>;
/** The newest civil date on or before `onOrBefore` that has an actual (non-cold-start) Recovery score. */
export declare function findMostRecentScoreDate(userId: string, onOrBefore: string): Promise<string | null>;
//# sourceMappingURL=dailyScore.d.ts.map