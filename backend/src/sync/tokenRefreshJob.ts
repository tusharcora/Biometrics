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
    try {
      const refreshToken = decryptToken(conn.encryptedRefreshToken);
      const tokens = await refreshFitbitTokens(refreshToken);
      await prisma.fitbitConnection.update({
        where: { id: conn.id },
        data: {
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(tokens.refreshToken),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
      });
    } catch {
      await prisma.fitbitConnection.update({ where: { id: conn.id }, data: { status: 'DISCONNECTED' } });
    }
  }
}
