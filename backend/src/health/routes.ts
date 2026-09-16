import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildAuthorizeUrl, exchangeCodeForTokens } from './oauth';
import { getIdentity, registerUserSubscription } from './subscriber';
import { isValidWebhookAuthorization } from './webhookVerify';
import { encryptToken } from '../crypto/tokenCipher';
import { enqueueBackfillJob, enqueueFetchJob } from '../sync/queue';
import { connection } from '../sync/queue';
import { prisma } from '../db/client';
import { BiometricMetricType } from '../types';

export const healthRouter = Router();

const OAUTH_STATE_TTL_SECONDS = 600;
const BACKFILL_WINDOW_DAYS = 30;

// Bare data type strings as they arrive in webhook notifications map to our metric types.
const WEBHOOK_DATA_TYPE_TO_METRIC: Record<string, BiometricMetricType> = {
  steps: 'STEPS',
  'heart-rate': 'RESTING_HR',
  sleep: 'SLEEP',
  heartRateVariability: 'HRV',
};

function oauthStateKey(state: string): string {
  return `oauth-state:${state}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The mobile app opens the Google Health authorize page in the system browser,
// which cannot attach our Authorization header, and Google's redirect back to
// /health/callback cannot carry one either. So this endpoint (which IS
// authenticated, because we need to know who is connecting) mints a
// short-lived single-use state token bound to the user, and the callback
// authenticates by consuming that token rather than by session JWT.
healthRouter.get('/health/authorize', requireAuth, async (req: AuthedRequest, res) => {
  const state = randomUUID();
  await connection.set(oauthStateKey(state), req.userId!, 'EX', OAUTH_STATE_TTL_SECONDS);
  res.json({ url: buildAuthorizeUrl(state) });
});

// Deliberately NOT behind requireAuth — see the note above. Identity comes from
// the state token, which is consumed on first use.
healthRouter.get('/health/callback', async (req, res) => {
  const state = req.query.state as string | undefined;
  if (!state) {
    res.status(400).json({ error: 'Missing state parameter' });
    return;
  }

  // GETDEL reads and deletes the key in a single atomic server-side operation,
  // so two concurrent requests presenting the same state token cannot both
  // observe a non-null userId before either delete completes.
  const userId = await connection.getdel(oauthStateKey(state));
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired state token' });
    return;
  }

  try {
    const code = req.query.code as string;
    const tokens = await exchangeCodeForTokens(code);
    const identity = await getIdentity(tokens.accessToken);

    const existing = await prisma.healthConnection.findUnique({ where: { userId } });

    try {
      // Register the webhook subscription BEFORE committing the connection as
      // CONNECTED. If registration fails we fall through to the catch below and
      // the row is never left claiming to be healthy with a subscription ID that
      // does not exist at Google.
      const subscriptionId = await registerUserSubscription(identity.healthUserId);

      await prisma.healthConnection.upsert({
        where: { userId },
        update: {
          healthUserId: identity.healthUserId,
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(tokens.refreshToken!),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          webhookSubscriptionId: subscriptionId,
          status: 'CONNECTED',
        },
        create: {
          userId,
          healthUserId: identity.healthUserId,
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(tokens.refreshToken!),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          webhookSubscriptionId: subscriptionId,
        },
      });

      const endDate = new Date();
      const startDate = existing?.lastSyncedAt
        ? existing.lastSyncedAt
        : new Date(endDate.getTime() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      await enqueueBackfillJob({ userId, startDate: isoDate(startDate), endDate: isoDate(endDate) });
    } catch (err) {
      console.error('Google Health subscription registration failed', err);
      res.status(500).json({ error: 'Failed to complete Google Health connection' });
      return;
    }

    res.redirect('biometrics://health/callback?status=connected');
  } catch (err) {
    console.error('Google Health callback failed', err);
    res.status(500).json({ error: 'Failed to complete Google Health connection' });
  }
});

healthRouter.get('/webhooks/health', (_req, res) => {
  // Google's subscriber endpoint verification happens automatically during
  // subscriber creation (see scripts/registerHealthSubscriber.ts) via a
  // POST-based handshake, not a per-request GET challenge like some other
  // providers use. This route exists only as a harmless fallback in case
  // Google ever sends a GET here.
  res.status(204).send();
});

interface HealthWebhookNotification {
  healthUserId: string;
  operation: string;
  dataType: string;
  intervals: { physicalTimeInterval: { startTime: string; endTime: string } }[];
}

healthRouter.post('/webhooks/health', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!isValidWebhookAuthorization(authHeader)) {
    res.status(401).send();
    return;
  }

  try {
    const notifications = req.body as { data: HealthWebhookNotification }[];
    for (const { data } of notifications) {
      if (data.operation !== 'UPSERT') continue; // conservative: skip any non-UPSERT operation, per spec's note that DELETE was never observed live

      const metricType = WEBHOOK_DATA_TYPE_TO_METRIC[data.dataType];
      if (!metricType) continue;

      // healthUserId is @unique on HealthConnection (Task 1), so a single
      // Google Health account maps to at most one app user.
      const conn = await prisma.healthConnection.findUnique({ where: { healthUserId: data.healthUserId } });
      if (!conn) continue;

      for (const interval of data.intervals) {
        const date = isoDate(new Date(interval.physicalTimeInterval.startTime));
        await enqueueFetchJob({ userId: conn.userId, metricType, date });
      }
    }
    res.status(204).send();
  } catch (err) {
    console.error('Google Health webhook notification processing failed', err);
    res.status(500).send();
  }
});
