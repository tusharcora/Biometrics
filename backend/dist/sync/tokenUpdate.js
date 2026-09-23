"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshedTokenUpdateData = refreshedTokenUpdateData;
const tokenCipher_1 = require("../crypto/tokenCipher");
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
function refreshedTokenUpdateData(tokens) {
    const data = {
        encryptedAccessToken: (0, tokenCipher_1.encryptToken)(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };
    if (tokens.refreshToken) {
        data.encryptedRefreshToken = (0, tokenCipher_1.encryptToken)(tokens.refreshToken);
    }
    return data;
}
//# sourceMappingURL=tokenUpdate.js.map