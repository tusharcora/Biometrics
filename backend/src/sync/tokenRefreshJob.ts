import { prisma } from '../db/client';
import { refreshHealthTokens } from '../health/oauth';
import { encryptToken, decryptToken } from '../crypto/tokenCipher';

const REFRESH_LOOKAHEAD_MS = 60 * 60 * 1000; // refresh anything expiring within the next hour

export async function runTokenRefreshSweep(): Promise<void> {
  const expiringSoon = await prisma.healthConnection.findMany({
    where: {
      status: 'CONNECTED',
      tokenExpiresAt: { lt: new Date(Date.now() + REFRESH_LOOKAHEAD_MS) },
    },
  });

  for (const conn of expiringSoon) {
    // Only a failure of the refresh itself means the connection is genuinely
    // dead. A failure of the DB write afterwards is a transient infrastructure
    // problem and must not disconnect a perfectly healthy connection.
    let tokens;
    try {
      const refreshToken = decryptToken(conn.encryptedRefreshToken);
      tokens = await refreshHealthTokens(refreshToken);
    } catch (err) {
      console.error(`Google Health token refresh failed for connection ${conn.id}`, err);
      await prisma.healthConnection.update({
        where: { id: conn.id },
        data: { status: 'DISCONNECTED' },
      });
      continue;
    }

    try {
      // Google does not return a new refresh_token on an ordinary refresh
      // call — only exchangeCodeForTokens does. Overwriting a present
      // encryptedRefreshToken with an absent one would destroy the only
      // credential capable of any future refresh, so only touch it when
      // Google actually sent one.
      const updateData: { encryptedAccessToken: string; tokenExpiresAt: Date; encryptedRefreshToken?: string } = {
        encryptedAccessToken: encryptToken(tokens.accessToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      };
      if (tokens.refreshToken) {
        updateData.encryptedRefreshToken = encryptToken(tokens.refreshToken);
      }
      await prisma.healthConnection.update({
        where: { id: conn.id },
        data: updateData,
      });
    } catch (err) {
      // The refresh succeeded, so the connection is fine; surface the write
      // failure instead of silently marking the user disconnected.
      console.error(`Failed to persist refreshed Google Health tokens for connection ${conn.id}`, err);
      throw err;
    }
  }
}
