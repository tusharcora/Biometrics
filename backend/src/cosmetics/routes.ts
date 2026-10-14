// KIP's room endpoints (spec 2026-10-14 KIP's room §5). All need a session and answer private, no-store. Nothing
// here is health data; nothing is logged with the user's id.
import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { markSeen, readCosmetics, saveCosmetics } from './loadout';

export const cosmeticsRouter = Router();
const noStore = (res: Response) => res.set('Cache-Control', 'private, no-store');

cosmeticsRouter.get('/me/cosmetics', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  res.json(await readCosmetics(req.userId!, new Date()));
});

cosmeticsRouter.put('/me/cosmetics', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const result = await saveCosmetics(req.userId!, req.body, new Date());
  if (!result.ok) {
    res.status(result.failure.status).json(result.failure.body);
    return;
  }
  res.json(result.dto);
});

cosmeticsRouter.post('/me/cosmetics/seen', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  if (!(await markSeen(req.userId!, req.body, new Date()))) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  res.status(204).end();
});
