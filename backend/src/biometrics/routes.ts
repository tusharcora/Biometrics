import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { getBiometricsForUser } from './repository';
import { prisma } from '../db/client';

export const biometricsRouter = Router();

biometricsRouter.get('/me/biometrics', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await getBiometricsForUser(req.userId!));
});

/**
 * Lets the client tell "connected", "needs reconnecting" and "never connected"
 * apart. Without it a disconnected user's dashboard just freezes on stale data
 * with no explanation, and a returning connected user has no route past the
 * connect screen.
 */
biometricsRouter.get('/me/connection', requireAuth, async (req: AuthedRequest, res) => {
  const conn = await prisma.fitbitConnection.findUnique({
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
