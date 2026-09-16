import type { HealthTokenResponse } from '../health/oauth';
import { encryptToken } from '../crypto/tokenCipher';

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
export function refreshedTokenUpdateData(tokens: HealthTokenResponse): RefreshedTokenUpdate {
  const data: RefreshedTokenUpdate = {
    encryptedAccessToken: encryptToken(tokens.accessToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
  };
  if (tokens.refreshToken) {
    data.encryptedRefreshToken = encryptToken(tokens.refreshToken);
  }
  return data;
}
