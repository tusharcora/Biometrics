// KIP coin endpoints (spec 2026-10-15 §12 P2): the wallet and its history and marking coins seen; Task 6 adds the shop
// and purchases, Task 8 the first-week list. All need a session and answer private, no-store; nothing is logged with
// the user's id.
import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { noStore } from '../lib/noStore';
import { decodeCursor, markCoinsSeen, readCoins } from './history';
import { earnCoinsSafely } from './sources';

export const coinsRouter = Router();

coinsRouter.get('/me/coins', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !decodeCursor(cursor))) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const now = new Date();
  // The catch-up (spec §6.3): a missed hook pays on the next look. Later pages only read. It never starts the first
  // week (ruling PF-F3): earns only write coin rows.
  if (cursor === undefined) await earnCoinsSafely(req.userId!, now);
  res.json(await readCoins(req.userId!, now, cursor));
});

coinsRouter.post('/me/coins/seen', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  if (!(await markCoinsSeen(req.userId!, req.body, new Date()))) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  res.status(204).end();
});
