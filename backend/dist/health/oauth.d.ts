export interface HealthTokenResponse {
    accessToken: string;
    refreshToken?: string | undefined;
    expiresIn: number;
}
export declare function buildAuthorizeUrl(state: string): string;
export declare function exchangeCodeForTokens(code: string): Promise<HealthTokenResponse>;
export declare function refreshHealthTokens(refreshToken: string): Promise<HealthTokenResponse>;
/**
 * Revokes a grant at Google (account deletion). Revoking the refresh token also
 * invalidates the access tokens minted from it. The error carries only the HTTP
 * status: the token is in the request body and must never reach a log.
 */
export declare function revokeHealthToken(refreshToken: string): Promise<void>;
//# sourceMappingURL=oauth.d.ts.map