export declare const MAX_ACTIVITY_RANGE_DAYS = 400;
export type ActivityRange = {
    from: string;
    to: string;
};
/** The validated inclusive [from, to] range, or the reason it is not one. */
export declare function parseActivityRange(from: unknown, to: unknown): ActivityRange | {
    error: string;
};
export interface ActivityDTO {
    days: {
        date: string;
        steps: number;
    }[];
    earliestDate: string | null;
}
/**
 * Daily steps for an inclusive civil-date range. STEPS records are already
 * keyed at UTC midnight of their civil date (dailyRollUp's civilStartTime), so
 * the date is read straight off recordedAt with no timezone conversion.
 */
export declare function getActivityForUser(userId: string, range: ActivityRange): Promise<ActivityDTO>;
//# sourceMappingURL=activity.d.ts.map