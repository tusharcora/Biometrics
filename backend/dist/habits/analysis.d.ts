import { HabitTypeConfig } from './config';
import { EngineInput, EngineOutput, FactorDay, FactorKey, NotEnoughData } from './engine';
/**
 * The correlation series for [from, through], per factor, keyed by civil date.
 * Sources are UserDailyFeatures' per-night z columns and their imputed flags.
 * (sleepDebtRolling14d is never read here: see FactorKey in engine.ts.)
 */
export declare function loadFactorSeries(userId: string, from: string, through: string, 
/** Only z and imputed are needed (pair counting): skips the queries that exist solely to derive `pct`. */
opts?: {
    countsOnly?: boolean;
}): Promise<Partial<Record<FactorKey, Map<string, FactorDay>>>>;
export interface UserAnalysisInput {
    input: EngineInput;
    types: HabitTypeConfig[];
    today: string;
}
/** Everything the engine needs for one user, over the trailing ANALYSIS_WINDOW_DAYS habit days. */
export declare function loadAnalysisInput(userId: string, now: Date, opts?: {
    countsOnly?: boolean;
}): Promise<UserAnalysisInput>;
/**
 * The live "N of 8 needed" counts, WITHOUT running the statistics: no
 * correlation, p-value or BH step, and none of the queries that only feed effect
 * sizes. Identical to analyzeUser(...).notEnoughData by construction (both go
 * through the engine's pair-counting gate). Deliberately live, not read from a
 * stored weekly run, so the count moves as soon as the user logs "nothing today".
 */
export declare function computeNotEnoughData(userId: string, now: Date): Promise<NotEnoughData[]>;
export declare function analyzeUser(userId: string, now: Date): Promise<EngineOutput & {
    types: HabitTypeConfig[];
}>;
//# sourceMappingURL=analysis.d.ts.map