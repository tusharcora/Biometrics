import { Direction } from './dailyScore';
export declare const METRIC_KEYS: readonly ["STEPS", "RESTING_HR", "HRV", "SLEEP"];
export type MetricKey = (typeof METRIC_KEYS)[number];
export declare const STEPS_GOAL = 10000;
export declare const MAX_HABIT_LOG_DAYS = 30;
/** Per-metric rounding: counts and bpm are whole numbers, HRV keeps one decimal. */
export declare function roundMetric(metric: MetricKey, value: number): number;
export declare function formatSteps(steps: number): string;
export declare function formatDuration(minutes: number): string;
export interface MetricOfDay {
    value: number | null;
    display: string | null;
    deltaFromYesterday: number | null;
    direction: Direction | null;
    /** The change as one readable phrase ("2h 25m less than the day before"); null when there is nothing to compare. */
    changeDisplay: string | null;
}
/**
 * The day-over-day change as a phrase, so the model never has to combine a
 * signed delta with a direction word (which produced "-145 less").
 */
export declare function describeChange(metric: MetricKey, delta: number | null): string | null;
export interface DailyMetricsToolResult {
    date: string;
    steps: MetricOfDay & {
        goal: number;
        percentOfGoal: number | null;
        percentOfGoalDisplay: string | null;
        goalMet: boolean | null;
    };
    restingHeartRate: MetricOfDay;
    hrv: MetricOfDay;
    sleep: MetricOfDay & {
        goalMinutes: number;
        goalDisplay: string;
        percentOfGoal: number | null;
        percentOfGoalDisplay: string | null;
    };
}
/** One day's raw metrics (null when not recorded), each compared with the day before. */
export declare function getDailyMetrics(userId: string, date: string): Promise<DailyMetricsToolResult>;
export interface HistoryPoint {
    date: string;
    /** "Sep 21": a date a person reads, and one the digit scan accepts inside a reference. */
    dateLabel: string;
    value: number;
    display: string;
}
export declare function dateLabel(date: string): string;
export declare function describeTrend(trend: MetricHistoryToolResult['trend'], pct: number | null): string | null;
export interface MetricHistoryToolResult {
    metric: MetricKey;
    days: number;
    daysWithData: number;
    points: HistoryPoint[];
    average: number | null;
    averageDisplay: string | null;
    highest: HistoryPoint | null;
    lowest: HistoryPoint | null;
    earliest: HistoryPoint | null;
    latest: HistoryPoint | null;
    /** Second-half average vs first-half average of the window; null with fewer than two readings. */
    trend: 'up' | 'down' | 'steady' | null;
    trendPercent: number | null;
    /** The trend as a phrase without a sign ("down 8%", "steady"), so the model never writes "down by -8%". */
    trendDisplay: string | null;
    /** "4 of 7": days with a reading out of the days asked about (the model adds "days"). */
    coverageDisplay: string;
    /** STEPS only: days at or above the step goal, and the same as "4 of 30". */
    daysAtGoal?: number;
    daysAtGoalDisplay?: string;
}
/**
 * Compares the average of the second half of the readings with the first
 * half, so one noisy day at either end cannot flip the answer. The model gets
 * this as a field instead of eyeballing the points (the spike found models
 * claiming trends the data did not support).
 */
export declare function computeTrend(values: number[]): {
    trend: MetricHistoryToolResult['trend'];
    trendPercent: number | null;
};
/** The last N days (ending today) of one metric, oldest first, with precomputed summary values. */
export declare function getMetricHistory(userId: string, metric: MetricKey, days: number, today: string): Promise<MetricHistoryToolResult>;
export interface HabitLogsToolResult {
    days: number;
    from: string;
    to: string;
    checkedInDays: number;
    habits: {
        habitType: string;
        habitLabel: string;
        unit: string;
        daysLogged: number;
        total: number;
        daysWithNone: number;
    }[];
    entries: {
        date: string;
        habitLabel: string;
        value: number;
        unit: string;
    }[];
    entriesTruncated: boolean;
}
/**
 * What the user logged over the last N days: a per-habit summary plus the
 * individual entries (newest first, capped). Free-text notes are never
 * included: they are the user's words, not data, and could carry anything.
 */
export declare function getHabitLogs(userId: string, days: number, today: string): Promise<HabitLogsToolResult>;
//# sourceMappingURL=metrics.d.ts.map