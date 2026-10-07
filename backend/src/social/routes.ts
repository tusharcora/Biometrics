// Social tab routes (spec 2026-10-07 social). Every path is /me/social…, so nothing collides with the Buddies
// `/me/buddies/:buddyId` routes. GETs are never cached.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { getTodayCheckIn, saveCheckIn } from './checkins';

export const socialRouter = Router();

socialRouter.get('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ checkIn: await getTodayCheckIn(req.userId!, new Date()) });
}));

socialRouter.put('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.json({ checkIn: await saveCheckIn(req.userId!, (req.body as { mood?: unknown } | undefined)?.mood, new Date()) });
}));
