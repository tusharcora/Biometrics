// KIP's room among buddies (spec 2026-10-15 §12 P4): visits and room cheers here; gifts (Task 6) and the weekly
// challenge (Task 7) join this router. All need a session, answer private no-store, and use the buddy error bodies.
// Every POST takes the 32 KB route parser (P2 ruling 26, P4 ruling 29).
import { Router, type Response } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { noStore } from '../lib/noStore';
import { cheerRoom, listRoomCheers, readVisit, visitTarget } from './visit';

export const socialRoomRouter = Router();
/** The POST paths app.ts gives the 32 KB parser (Tasks 6 and 7 add theirs). */
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
