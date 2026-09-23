export declare function getIdentity(userAccessToken: string): Promise<{
    healthUserId: string;
}>;
export declare function registerUserSubscription(healthUserId: string): Promise<string>;
export declare function deleteUserSubscription(subscriptionId: string): Promise<void>;
//# sourceMappingURL=subscriber.d.ts.map