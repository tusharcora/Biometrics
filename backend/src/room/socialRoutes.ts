// KIP's room among buddies (spec 2026-10-15 §12 P4): visits, room cheers and gifts here; the weekly challenge
// joins this router. All need a session, answer private no-store, and use the buddy error bodies.
// Every POST takes the 32 KB route parser (P2 ruling 26, P4 ruling 29).
import { Router, type Response } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { cheerEntry, enterChallenge, readChallenge } from '../challenges/entries';
import { challengeClock } from '../challenges/week';
import { noStore } from '../lib/noStore';
import { listGifts, openGift, sendGift } from './gifts';
import { cheerRoom, listRoomCheers, readVisit, visitTarget } from './visit';

export const socialRoomRouter = Router();
/** The POST paths app.ts gives the 32 KB parser (the gift and challenge routes push theirs below). */
export const SOCIAL_ROOM_POSTS: string[] = ['/me/buddies/:buddyId/room/cheer'];

const json = (res: Response, body: unknown, status = 200) => {
  noStore(res);
  res.status(status).json(body);
};

// noStore runs before the handler can throw, so a BuddyError body is private no-store too.
socialRoomRouter.get('/me/buddies/:buddyId/room', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await readVisit(req.userId!, visitTarget(String(req.params.buddyId), req.userId!), new Date()));
}));

socialRoomRouter.post('/me/buddies/:buddyId/room/cheer', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await cheerRoom(req.userId!, visitTarget(String(req.params.buddyId), req.userId!), new Date()));
}));

socialRoomRouter.get('/me/room/cheers', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await listRoomCheers(req.userId!, new Date()));
}));

// Gifts (spec §10.3, §12; P4 rulings 11-13).
SOCIAL_ROOM_POSTS.push('/me/buddies/:buddyId/gifts', '/me/gifts/:id/open');

socialRoomRouter.post('/me/buddies/:buddyId/gifts', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await sendGift(req.userId!, String(req.params.buddyId), req.body, new Date()), 201);
}));

socialRoomRouter.get('/me/gifts', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await listGifts(req.userId!));
}));

socialRoomRouter.post('/me/gifts/:id/open', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await openGift(req.userId!, String(req.params.id), new Date()));
}));

// The weekly theme challenge (spec §10.4, §12; P4 rulings 5-7, 10, 28). Its clock is challengeClock (tests move it).
SOCIAL_ROOM_POSTS.push('/me/challenge/entry', '/me/challenge/entries/:userId/cheer');

socialRoomRouter.get('/me/challenge', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await readChallenge(req.userId!, challengeClock.now()));
}));

socialRoomRouter.post('/me/challenge/entry', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await enterChallenge(req.userId!, challengeClock.now()));
}));

socialRoomRouter.post('/me/challenge/entries/:userId/cheer', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await cheerEntry(req.userId!, String(req.params.userId), challengeClock.now()));
}));
