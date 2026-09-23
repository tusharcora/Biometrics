import type { Prisma, PrismaClient } from '@prisma/client';
/**
 * Every model that carries a `userId`, in an FK-safe delete order: children
 * before parents (CoachMessage references CoachConversation), and all of them
 * before the User row their foreign keys point at. Names are Prisma model names
 * as they appear in the schema.
 */
export declare const USER_OWNED_MODELS: readonly ["BiometricRecord", "SleepSession", "UserDailyFeatures", "BaselineSnapshot", "DailyScore", "ScoreInputFlag", "HabitLog", "HabitCheckIn", "HabitType", "HabitCorrelation", "CoachMessage", "CoachConversation", "CoachMemory", "CoachDigest", "CoachConsent", "PushToken", "RefreshToken", "HealthConnection"];
export type UserOwnedModel = (typeof USER_OWNED_MODELS)[number];
/** Per-table row counts, as returned by deletion and by the fixture purge: one entry per owned table, plus the users. */
export type OwnedCounts = Record<UserOwnedModel | 'User', number>;
type BulkDelegate = {
    deleteMany(args: {
        where: object;
    }): Prisma.PrismaPromise<{
        count: number;
    }>;
    count(args: {
        where: object;
    }): Prisma.PrismaPromise<number>;
};
/** The Prisma delegate for a model name (`CoachMessage` -> `client.coachMessage`). */
export declare function delegateFor(client: PrismaClient, model: UserOwnedModel | 'User'): BulkDelegate;
/**
 * Deletes, in ONE transaction and in USER_OWNED_MODELS order, the rows of every
 * owned table matching `ownedWhere` and then the users matching `userWhere`.
 * Returns per-table counts.
 */
export declare function deleteOwnedRows(client: PrismaClient, ownedWhere: object, userWhere: object): Promise<OwnedCounts>;
export interface AccountDeletionDeps {
    deleteSubscription: (subscriptionId: string) => Promise<void>;
    revokeToken: (refreshToken: string) => Promise<void>;
    log: (message: string) => void;
}
export interface AccountDeletionSummary {
    /** Whether the Google-side steps succeeded; both are false when the user had no connection. */
    googleSubscriptionDeleted: boolean;
    googleTokenRevoked: boolean;
    counts: OwnedCounts;
}
/**
 * Deletes the user and everything they own. Idempotent: for an unknown user it
 * deletes nothing and does not throw.
 */
export declare function deleteUserAccount(userId: string, deps?: Partial<AccountDeletionDeps>): Promise<AccountDeletionSummary>;
export {};
//# sourceMappingURL=deletion.d.ts.map