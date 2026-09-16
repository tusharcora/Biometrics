import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildAuthorizeUrl, exchangeCodeForTokens } from './oauth';
import { encryptToken } from '../crypto/tokenCipher';
import { registerWebhookSubscription } from './subscription';
import { isValidVerificationCode, isValidWebhookSignature } from './webhookVerify';
import { connection, enqueueBackfillJob, enqueueFetchJob } from '../sync/queue';
import { prisma } from '../db/client';

export const fitbitRouter = Router();

const BACKFILL_WINDOW_DAYS = 30;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function oauthStateKey(state: string): string {
  return `oauth-state:${state}`;
}
// Fitbit's HRV data is sleep-derived, so the notification for it may arrive
// under `sleep` rather than `activities`. Rather than guess wrong and have HRV
// silently never sync via webhook, both collections trigger an HRV fetch. The
// occasional redundant re-fetch is harmless: the repository upsert is
// idempotent.
const FITBIT_WEBHOOK_COLLECTIONS: Record<string, ('HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS')[]> = {
  sleep: ['SLEEP', 'HRV'],
  activities: ['RESTING_HR', 'STEPS', 'HRV'],
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The mobile app opens the Fitbit authorize page in the system browser, which
// cannot attach our Authorization header, and Fitbit's redirect back to
// /fitbit/callback cannot carry one either. So this endpoint (which IS
// authenticated, because we need to know who is connecting) mints a
// short-lived single-use state token bound to the user, and the callback
// authenticates by consuming that token rather than by session JWT.
fitbitRouter.get('/fitbit/authorize', requireAuth, async (req: AuthedRequest, res) => {
  const state = randomUUID();
  await connection.set(oauthStateKey(state), req.userId!, 'EX', OAUTH_STATE_TTL_SECONDS);
  res.json({ url: buildAuthorizeUrl(state) });
});

// Deliberately NOT behind requireAuth — see the note above. Identity comes from
// the state token, which is consumed on first use.
fitbitRouter.get('/fitbit/callback', async (req, res) => {
  const state = req.query.state as string | undefined;
  if (!state) {
    res.status(400).json({ error: 'Missing OAuth state' });
    return;
  }

  const userId = await connection.get(oauthStateKey(state));
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired OAuth state' });
    return;
  }
  await connection.del(oauthStateKey(state));

  try {
    const code = req.query.code as string;
    const tokens = await exchangeCodeForTokens(code);
    const subscriptionId = randomUUID();

    const existing = await prisma.fitbitConnection.findUnique({ where: { userId } });

    // Register the webhook subscription BEFORE committing the connection as
    // CONNECTED. If registration fails we fall through to the catch below and
    // the row is never left claiming to be healthy with a subscription ID that
    // does not exist at Fitbit.
    await registerWebhookSubscription(tokens.fitbitUserId, tokens.accessToken, subscriptionId);

    await prisma.fitbitConnection.upsert({
      where: { userId },
      update: {
        fitbitUserId: tokens.fitbitUserId,
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        webhookSubscriptionId: subscriptionId,
        status: 'CONNECTED',
      },
      create: {
        userId,
        fitbitUserId: tokens.fitbitUserId,
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        webhookSubscriptionId: subscriptionId,
      },
    });

    const endDate = new Date();
    const startDate = existing?.lastSyncedAt
      ? existing.lastSyncedAt
      : new Date(endDate.getTime() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await enqueueBackfillJob({
      userId,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
    });

    res.redirect(`biometrics://fitbit/callback?status=connected`);
  } catch (err) {
    console.error('Fitbit callback failed', err);
    res.status(500).json({ error: 'Failed to complete Fitbit connection' });
  }
});

fitbitRouter.get('/webhooks/fitbit', (req, res) => {
  const verify = req.query.verify as string | undefined;
  if (verify && isValidVerificationCode(verify)) {
    res.status(204).send();
  } else {
    res.status(404).send();
  }
});

interface FitbitNotification {
  collectionType: string;
  date: string;
  ownerId: string;
}

fitbitRouter.post('/webhooks/fitbit', async (req, res) => {
  const signature = req.headers['x-fitbit-signature'] as string | undefined;
  const rawBody = (req as any).rawBody as Buffer;
  if (!isValidWebhookSignature(rawBody, signature)) {
    res.status(401).send();
    return;
  }

  try {
    const notifications = JSON.parse(rawBody.toString()) as FitbitNotification[];
    for (const notification of notifications) {
      // A Fitbit account maps to at most one app user (fitbitUserId is unique),
      // so both branches below look the connection up singularly.
      const conn = await prisma.fitbitConnection.findUnique({
        where: { fitbitUserId: notification.ownerId },
      });
      if (!conn) continue;

      if (notification.collectionType === 'userRevokedAccess') {
        await prisma.fitbitConnection.update({
          where: { fitbitUserId: notification.ownerId },
          data: { status: 'DISCONNECTED' },
        });
        continue;
      }

      const metricTypes = FITBIT_WEBHOOK_COLLECTIONS[notification.collectionType] ?? [];
      for (const metricType of metricTypes) {
        await enqueueFetchJob({ userId: conn.userId, metricType, date: notification.date });
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Fitbit webhook notification processing failed', err);
    res.status(500).send();
  }
});
