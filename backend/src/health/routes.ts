import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildAuthorizeUrl, exchangeCodeForTokens } from './oauth';
import { getIdentity, registerUserSubscription, deleteUserSubscription } from './subscriber';
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
    // The initial authorization_code exchange (with access_type=offline and
    // prompt=consent) is the ONLY point at which Google issues a refresh
    // token; ordinary refresh calls never return one. Without it the
    // connection is unrecoverable after ~1 hour, so treat its absence as a
    // hard failure here rather than storing an unusable connection.
    if (!tokens.refreshToken) {
      throw new Error('Google did not return a refresh token during the initial OAuth exchange');
    }
    const refreshToken = tokens.refreshToken;
    const identity = await getIdentity(tokens.accessToken);

    const existing = await prisma.healthConnection.findUnique({ where: { userId } });

    let subscriptionId: string | undefined;
    let connectionPersisted = false;
    try {
      // Register the webhook subscription BEFORE committing the connection as
      // CONNECTED. If registration fails we fall through to the catch below and
      // the row is never left claiming to be healthy with a subscription ID that
      // does not exist at Google.
      subscriptionId = await registerUserSubscription(identity.healthUserId);

      await prisma.healthConnection.upsert({
        where: { userId },
        update: {
          healthUserId: identity.healthUserId,
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(refreshToken),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          webhookSubscriptionId: subscriptionId,
          status: 'CONNECTED',
        },
        create: {
          userId,
          healthUserId: identity.healthUserId,
          encryptedAccessToken: encryptToken(tokens.accessToken),
          encryptedRefreshToken: encryptToken(refreshToken),
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          webhookSubscriptionId: subscriptionId,
        },
      });
      connectionPersisted = true;

      // Re-running the connect flow while already connected (re-consent, a
      // second tap on Connect, a scope change) creates a brand-new Google
      // subscription. The upsert above has just overwritten the old ID, so
      // delete the old subscription at Google or it keeps delivering
      // notifications forever with nothing referencing it. Best effort: a
      // failure here must never fail an otherwise-successful connect.
      const previousSubscriptionId = existing?.webhookSubscriptionId;
      if (previousSubscriptionId && previousSubscriptionId !== subscriptionId) {
        try {
          await deleteUserSubscription(previousSubscriptionId);
        } catch (deleteErr) {
          console.error(`Failed to delete superseded Google Health subscription ${previousSubscriptionId}`, deleteErr);
        }
      }

      const endDate = new Date();
      const startDate = existing?.lastSyncedAt
        ? existing.lastSyncedAt
        : new Date(endDate.getTime() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      await enqueueBackfillJob({ userId, startDate: isoDate(startDate), endDate: isoDate(endDate) });
    } catch (err) {
      console.error('Google Health subscription registration or connection write failed', err);
      // If the subscription was created at Google but the connection row was
      // never written (e.g. the upsert hit a unique-constraint violation on
      // healthUserId), nothing references the new subscription ID: delete it
      // so it is not orphaned. Skipped once the row IS persisted, because at
      // that point the ID is referenced and deleting it would strand a
      // CONNECTED row with a dead subscription.
      if (subscriptionId && !connectionPersisted) {
        try {
          await deleteUserSubscription(subscriptionId);
        } catch (deleteErr) {
          console.error(`Failed to roll back orphaned Google Health subscription ${subscriptionId}`, deleteErr);
        }
      }
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

// Shape of one notification's `data`, per the spec's confirmed live payload.
// Every field is treated as untrusted at runtime (see the handler below).
interface HealthWebhookInterval {
  physicalTimeInterval?: { startTime?: string; endTime?: string };
  // The spec's live observation shows this as "structured local date/time"
  // without spelling out the nesting. Google's other civil-time structures in
  // this API (e.g. dailyRollUp's civilStartTime) use { date: {year, month,
  // day} }, so that is the shape probed for here.
  civilDateTimeInterval?: {
    startTime?: { date?: { year?: number; month?: number; day?: number } };
    endTime?: { date?: { year?: number; month?: number; day?: number } };
  };
  // Confirmed live as RFC3339-style local (civil) timestamps.
  civilIso8601TimeInterval?: { startTime?: string; endTime?: string };
}

interface HealthWebhookNotification {
  healthUserId: string;
  operation: string;
  dataType: string;
  intervals?: HealthWebhookInterval[];
}

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Resolves the civil (local) calendar date a changed interval belongs to, as
 * YYYY-MM-DD, or null if the interval carries nothing usable.
 *
 * dailyRollUp (STEPS / RESTING_HR) buckets by the user's civil date, so the
 * day we re-fetch must be the civil date too. Deriving it from the UTC date
 * of `physicalTimeInterval.startTime` is wrong for users west of UTC in the
 * evening (the instant is already "tomorrow" in UTC) -- hence the civil
 * fields are preferred and the UTC computation is only a last-resort
 * fallback.
 *
 * TODO(device-verification): the exact nesting of civilDateTimeInterval and
 * the precise format of civilIso8601TimeInterval.startTime were not
 * re-verified against a live notification in this pass (no live credentials
 * or tunnel available). Confirm both against a captured real payload during
 * the pending device-verification pass and tighten this resolver
 * accordingly.
 */
function civilDateOfInterval(interval: HealthWebhookInterval): string | null {
  const structured = interval.civilDateTimeInterval?.startTime?.date;
  if (
    structured &&
    Number.isInteger(structured.year) &&
    Number.isInteger(structured.month) &&
    Number.isInteger(structured.day)
  ) {
    return `${structured.year}-${pad2(structured.month as number)}-${pad2(structured.day as number)}`;
  }

  const civilIso = interval.civilIso8601TimeInterval?.startTime;
  if (typeof civilIso === 'string') {
    const m = ISO_DATE_PREFIX.exec(civilIso);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }

  const physical = interval.physicalTimeInterval?.startTime;
  if (typeof physical === 'string') {
    const d = new Date(physical);
    if (!Number.isNaN(d.getTime())) return isoDate(d);
  }

  return null;
}

healthRouter.post('/webhooks/health', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!isValidWebhookAuthorization(authHeader)) {
    res.status(401).send();
    return;
  }

  // The body is a JSON array of notifications (confirmed live). Anything else
  // is treated as an empty batch rather than an error: Google's subscriber
  // verification handshake POSTs to this endpoint with the shared secret and
  // expects a 2xx, and a non-array (or absent) body must not turn that into
  // a failure. Nothing is enqueued for it either way.
  const notifications: unknown[] = Array.isArray(req.body) ? req.body : [];

  try {
    for (const item of notifications) {
      // Each notification is processed in isolation: one malformed item is
      // logged and skipped so it cannot 500 the whole batch, which would make
      // Google redeliver items that were already enqueued successfully.
      try {
        const data = (item as { data?: HealthWebhookNotification } | null)?.data;
        if (!data || typeof data !== 'object') {
          console.warn('Skipping Google Health webhook item with no data object');
          continue;
        }

        if (data.operation !== 'UPSERT') continue; // conservative: skip any non-UPSERT operation, per spec's note that DELETE was never observed live

        const metricType = WEBHOOK_DATA_TYPE_TO_METRIC[data.dataType];
        if (!metricType) continue;

        // healthUserId is @unique on HealthConnection (Task 1), so a single
        // Google Health account maps to at most one app user.
        const conn = await prisma.healthConnection.findUnique({ where: { healthUserId: data.healthUserId } });
        if (!conn) continue;

        const intervals = Array.isArray(data.intervals) ? data.intervals : [];
        for (const interval of intervals) {
          const date = interval && typeof interval === 'object' ? civilDateOfInterval(interval) : null;
          if (!date) {
            console.warn(`Skipping Google Health webhook interval with no resolvable date for ${data.dataType}`);
            continue;
          }
          await enqueueFetchJob({ userId: conn.userId, metricType, date });
        }
      } catch (itemErr) {
        console.error('Skipping malformed Google Health webhook notification', itemErr);
      }
    }
    res.status(204).send();
  } catch (err) {
    console.error('Google Health webhook notification processing failed', err);
    res.status(500).send();
  }
});
