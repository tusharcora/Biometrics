export declare const COACH_CONSENT_VERSION = "2";
export interface ConsentText {
    version: string;
    summary: string;
    dataItems: string[];
}
export declare const COACH_CONSENT: ConsentText;
/** True when the user's latest un-revoked consent is for the CURRENT version. */
export declare function hasCurrentConsent(userId: string): Promise<boolean>;
/** Idempotent: a repeat grant for the current version does not add a row. */
export declare function grantConsent(userId: string): Promise<void>;
export declare function revokeConsent(userId: string): Promise<void>;
//# sourceMappingURL=consent.d.ts.map