export interface PlannedCall {
    name: 'getMetricHistory' | 'getHabitLogs';
    args: Record<string, unknown>;
}
/** How many days the question covers; `fallback` when it names no span. */
export declare function daysFromQuestion(message: string, fallback: number, max: number): number;
export declare function planPrefetch(message: string): PlannedCall[];
//# sourceMappingURL=prefetch.d.ts.map