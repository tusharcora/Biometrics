import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildAuthorizeUrl, exchangeCodeForTokens } from './oauth';
import { encryptToken } from '../crypto/tokenCipher';
import { registerWebhookSubscription } from './subscription';
import { isValidVerificationCode, isValidWebhookSignature } from './webhookVerify';
import { enqueueBackfillJob, enqueueFetchJob } from '../sync/queue';
import { prisma } from '../db/client';

export const fitbitRouter = Router();

const BACKFILL_WINDOW_DAYS = 30;
const FITBIT_WEBHOOK_COLLECTIONS: Record<string, ('HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS')[]> = {
  sleep: ['SLEEP'],
  activities: ['RESTING_HR', 'STEPS', 'HRV'],
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

fitbitRouter.get('/fitbit/authorize', requireAuth, (req: AuthedRequest, res) => {
  res.redirect(buildAuthorizeUrl(req.userId!));
});

fitbitRouter.get('/fitbit/callback', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const code = req.query.code as string;
    const tokens = await exchangeCodeForTokens(code);
    const subscriptionId = randomUUID();

    const existing = await prisma.fitbitConnection.findUnique({ where: { userId: req.userId! } });

    await prisma.fitbitConnection.upsert({
      where: { userId: req.userId! },
      update: {
        fitbitUserId: tokens.fitbitUserId,
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        webhookSubscriptionId: subscriptionId,
        status: 'CONNECTED',
      },
      create: {
        userId: req.userId!,
        fitbitUserId: tokens.fitbitUserId,
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        webhookSubscriptionId: subscriptionId,
      },
    });

    await registerWebhookSubscription(tokens.fitbitUserId, tokens.accessToken, subscriptionId);

    const endDate = new Date();
    const startDate = existing?.lastSyncedAt
      ? existing.lastSyncedAt
      : new Date(endDate.getTime() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await enqueueBackfillJob({
      userId: req.userId!,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
    });

    res.json({ status: 'connected' });
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
      if (notification.collectionType === 'userRevokedAccess') {
        await prisma.fitbitConnection.updateMany({
          where: { fitbitUserId: notification.ownerId },
          data: { status: 'DISCONNECTED' },
        });
        continue;
      }

      const conn = await prisma.fitbitConnection.findFirst({ where: { fitbitUserId: notification.ownerId } });
      if (!conn) continue;

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
