// Social tab routes (spec 2026-10-07 social). Every path is /me/social…, so nothing collides with the Buddies
// `/me/buddies/:buddyId` routes. GETs are never cached.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { getTodayCheckIn, saveCheckIn } from './checkins';
import { isRecapShared, shareRecap, unshareRecap } from './recapShares';

export const socialRouter = Router();

socialRouter.get('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ checkIn: await getTodayCheckIn(req.userId!, new Date()) });
}));

socialRouter.put('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.json({ checkIn: await saveCheckIn(req.userId!, (req.body as { mood?: unknown } | undefined)?.mood, new Date()) });
}));

socialRouter.post('/me/social/recap-shares', requireAuth, buddyRoute(async (req, res) => {
  res.json(await shareRecap(req.userId!, (req.body as { recapId?: unknown } | undefined)?.recapId, new Date()));
}));

socialRouter.get('/me/social/recap-shares/:recapId', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ shared: await isRecapShared(req.userId!, String(req.params.recapId)) });
}));

socialRouter.delete('/me/social/recap-shares/:recapId', requireAuth, buddyRoute(async (req, res) => {
  await unshareRecap(req.userId!, String(req.params.recapId));
  res.status(204).end();
}));
