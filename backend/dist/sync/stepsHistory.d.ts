export declare const STEPS_HISTORY_DAYS = 365;
/** The half-open [start, end) window of the steps history, ending at (excluding) `today`. */
export declare function stepsHistoryWindow(today?: Date): {
    startDate: string;
    endDate: string;
};
/**
 * Enqueues the steps history backfill for every connected user it has not yet
 * succeeded for. Runs once at server start, so users who connected before the
 * heat map existed get their history without reconnecting. Returns how many
 * were enqueued.
 */
export declare function enqueuePendingStepsHistoryBackfills(): Promise<number>;
//# sourceMappingURL=stepsHistory.d.ts.map