import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { getBiometricsForUser } from './repository';
import { getActivityForUser, parseActivityRange } from './activity';
import { prisma } from '../db/client';

export const biometricsRouter = Router();

biometricsRouter.get('/me/biometrics', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await getBiometricsForUser(req.userId!));
});

/**
 * Daily steps for the activity heat map over a bounded civil-date range
 * (?from=YYYY-MM-DD&to=YYYY-MM-DD, both inclusive). Bounded because a year of
 * history is too much to pull through the unbounded /me/biometrics.
 */
biometricsRouter.get('/me/activity', requireAuth, async (req: AuthedRequest, res) => {
  const range = parseActivityRange(req.query.from, req.query.to);
  if ('error' in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  res.json(await getActivityForUser(req.userId!, range));
});

/**
 * Lets the client tell "connected", "needs reconnecting" and "never connected"
 * apart. Without it a disconnected user's dashboard just freezes on stale data
 * with no explanation, and a returning connected user has no route past the
 * connect screen.
 */
biometricsRouter.get('/me/connection', requireAuth, async (req: AuthedRequest, res) => {
  const conn = await prisma.healthConnection.findUnique({
    where: { userId: req.userId! },
    select: { status: true, lastSyncedAt: true },
  });

  if (!conn) {
    res.json({ status: 'NOT_CONNECTED', lastSyncedAt: null });
    return;
  }

  res.json({
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
  });
});
