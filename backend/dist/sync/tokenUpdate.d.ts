import type { HealthTokenResponse } from '../health/oauth';
export interface RefreshedTokenUpdate {
    encryptedAccessToken: string;
    tokenExpiresAt: Date;
    encryptedRefreshToken?: string;
}
/**
 * Builds the Prisma update payload for a HealthConnection after a successful
 * token refresh. Shared by the scheduled refresh sweep and the sync worker's
 * on-401 refresh so both persist tokens the same way.
 *
 * Google does not return a new refresh_token on an ordinary refresh call --
 * only exchangeCodeForTokens does. Overwriting a present encryptedRefreshToken
 * with an absent one would destroy the only credential capable of any future
 * refresh, so encryptedRefreshToken is only included when Google actually
 * sent one.
 */
export declare function refreshedTokenUpdateData(tokens: HealthTokenResponse): RefreshedTokenUpdate;
//# sourceMappingURL=tokenUpdate.d.ts.map