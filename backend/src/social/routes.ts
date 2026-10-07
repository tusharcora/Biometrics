// Social tab routes (spec 2026-10-07 social). Every path is /me/social… or the Campfire's /me/camp… (spec §6.4), so
// nothing collides with the Buddies `/me/buddies/:buddyId` routes. GETs are never cached.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { getTodayCheckIn, saveCheckIn } from './checkins';
import { sayGoodnight, undoGoodnight } from './goodnight';
import { getWeeklyHighlights } from './highlights';
import { getSocialHome, markStickersSeen } from './home';
import { isRecapShared, shareRecap, unshareRecap } from './recapShares';
import { getStory, markStorySeen } from './stories';

export const socialRouter = Router();

socialRouter.get('/me/social', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json(await getSocialHome(req.userId!, new Date()));
}));

socialRouter.post('/me/social/stickers/seen', requireAuth, buddyRoute(async (req, res) => {
  await markStickersSeen(req.userId!, new Date());
  res.status(204).end();
}));

socialRouter.get('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ checkIn: await getTodayCheckIn(req.userId!, new Date()) });
}));

socialRouter.put('/me/social/checkin', requireAuth, buddyRoute(async (req, res) => {
  res.json({ checkIn: await saveCheckIn(req.userId!, (req.body as { mood?: unknown } | undefined)?.mood, new Date()) });
}));

socialRouter.post('/me/social/recap-shares', requireAuth, buddyRoute(async (req, res) => {
  const body = req.body as { recapId?: unknown; line?: unknown } | undefined;
  res.json(await shareRecap(req.userId!, body?.recapId, body?.line, new Date()));
}));

socialRouter.get('/me/social/recap-shares/:recapId', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ shared: await isRecapShared(req.userId!, String(req.params.recapId)) });
}));

socialRouter.delete('/me/social/recap-shares/:recapId', requireAuth, buddyRoute(async (req, res) => {
  await unshareRecap(req.userId!, String(req.params.recapId));
  res.status(204).end();
}));

socialRouter.get('/me/social/stories/:authorId', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json(await getStory(req.userId!, String(req.params.authorId), new Date()));
}));

socialRouter.post('/me/social/stories/:authorId/seen', requireAuth, buddyRoute(async (req, res) => {
  await markStorySeen(req.userId!, String(req.params.authorId), new Date());
  res.status(204).end();
}));

socialRouter.get('/me/social/highlights', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ highlights: await getWeeklyHighlights(req.userId!, new Date()) });
}));

socialRouter.post('/me/camp/goodnight', requireAuth, buddyRoute(async (req, res) => {
  res.json({ goodnight: await sayGoodnight(req.userId!, new Date()) });
}));

socialRouter.delete('/me/camp/goodnight', requireAuth, buddyRoute(async (req, res) => {
  await undoGoodnight(req.userId!, new Date());
  res.status(204).end();
}));
