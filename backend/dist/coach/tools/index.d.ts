import { MemoryProposal } from '../memory';
import { DailyScoreToolResult } from './dailyScore';
import { DailyMetricsToolResult } from './metrics';
export type { DailyScoreToolResult } from './dailyScore';
export interface CoachToolSchema {
    name: string;
    description: string;
    /** JSON Schema for the arguments, handed to the model provider. */
    parameters: Record<string, unknown>;
}
export type ToolOutcome = {
    ok: true;
    result: unknown;
} | {
    ok: false;
    error: 'unknown_tool' | 'invalid_arguments' | 'memory_rejected';
};
export interface ToolContext {
    /** The user's local civil date. */
    today: string;
}
export interface CoachTools {
    schemas: CoachToolSchema[];
    /** Validates arguments and runs one tool. Never throws for a bad call; DB failures propagate. */
    run(userId: string, name: string, args: unknown, ctx: ToolContext): Promise<ToolOutcome>;
    /** Typed access for the orchestrator's turn preamble. */
    getDailyScore(userId: string, date: string): Promise<DailyScoreToolResult>;
    findMostRecentScoreDate(userId: string, onOrBefore: string): Promise<string | null>;
    /** Today's raw readings for the preamble. Optional so narrow test doubles need not provide it. */
    getDailyMetrics?(userId: string, date: string): Promise<DailyMetricsToolResult>;
}
export declare const MAX_HISTORY_DAYS = 90;
declare const HISTORY_METRICS: readonly ["RECOVERY", "SLEEP"];
type HistoryMetric = (typeof HISTORY_METRICS)[number];
export declare const COACH_TOOL_SCHEMAS: CoachToolSchema[];
/**
 * The one tool that is not read-only, and it is still not a writer: proposeMemory
 * only VALIDATES the proposal (closed category enum, <= 140 chars, health-fact
 * classifier) and hands it back. The orchestrator persists it as PENDING only
 * after the whole reply has passed the grounding guardrail, so a discarded or
 * timed-out turn never leaves a row behind. Kept out of COACH_TOOL_SCHEMAS
 * (the read-only registry the spec lists) and added to what the model sees below.
 */
export declare const PROPOSE_MEMORY_SCHEMA: CoachToolSchema;
/** What a successful proposeMemory outcome carries back to the orchestrator. */
export interface ProposeMemoryResult {
    proposal: MemoryProposal;
}
export declare function getScoreHistory(userId: string, metric: HistoryMetric, days: number, today: string): Promise<{
    metric: "SLEEP" | "RECOVERY";
    days: number;
    points: {
        date: string;
        score: number;
    }[];
    average: number | null;
    highest: number | null;
    lowest: number | null;
}>;
export declare function getHabitCorrelations(userId: string): Promise<{
    correlations: {
        habitType: string;
        habitLabel: string;
        exposureThreshold: number;
        exposureUnit: string;
        factor: string;
        lagDays: number;
        effectSizePercent: number;
        comparisonPercent: number;
        sampleSize: number;
        direction: "higher" | "lower";
    }[];
}>;
export declare function getUserGoals(userId: string): Promise<{
    sleepGoalMinutes: number;
    sleepGoalHours: number;
}>;
export declare const coachTools: CoachTools;
//# sourceMappingURL=index.d.ts.map