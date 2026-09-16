import { prisma } from '../db/client';
import { refreshFitbitTokens } from '../fitbit/oauth';
import { encryptToken, decryptToken } from '../crypto/tokenCipher';

const REFRESH_LOOKAHEAD_MS = 60 * 60 * 1000; // refresh anything expiring within the next hour

export async function runTokenRefreshSweep(): Promise<void> {
  const expiringSoon = await prisma.fitbitConnection.findMany({
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
      tokens = await refreshFitbitTokens(refreshToken);
    } catch (err) {
      console.error(`Fitbit token refresh failed for connection ${conn.id}`, err);
      await prisma.fitbitConnection.update({
        where: { id: conn.id },
        data: { status: 'DISCONNECTED' },
      });
      continue;
    }

    try {
      await prisma.fitbitConnection.update({
        where: { id: conn.id },
        data: {
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(tokens.refreshToken),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
      });
    } catch (err) {
      // The refresh succeeded, so the connection is fine; surface the write
      // failure instead of silently marking the user disconnected.
      console.error(`Failed to persist refreshed Fitbit tokens for connection ${conn.id}`, err);
      throw err;
    }
  }
}
