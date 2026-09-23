import type { CoachTelemetry } from './telemetry';
export declare const TRANSCRIPT_RETENTION_DAYS = 90;
export interface RetentionSummary {
    messagesDeleted: number;
    conversationsDeleted: number;
    cutoff: Date;
}
/**
 * Deletes messages STRICTLY older than the retention window: a message exactly
 * `retentionDays` old is kept, one a millisecond older is deleted. Then deletes
 * conversations that are now empty AND stale (their last activity is also past
 * the cutoff), so a conversation being created right now is never touched.
 */
export declare function runCoachRetention({ now, retentionDays, telemetry, }?: {
    now?: Date;
    retentionDays?: number;
    telemetry?: CoachTelemetry;
}): Promise<RetentionSummary>;
export interface UserDataDeletionSummary {
    messages: number;
    conversations: number;
    memories: number;
    digests: number;
    consents: number;
    pushTokens: number;
}
/** Hard-deletes all coach data for a user, atomically. Idempotent: a second call deletes nothing. */
export declare function deleteUserCoachData(userId: string, telemetry?: CoachTelemetry): Promise<UserDataDeletionSummary>;
//# sourceMappingURL=retention.d.ts.map