// KIP coin endpoints (spec 2026-10-15 §12 P2): the wallet and its history, marking coins seen, the shop and purchases;
// Task 8 adds the first-week list. All need a session and answer private, no-store; the POSTs take the 32 KB parser
// (app.ts, plan ruling 26); nothing is logged with the user's id.
import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { noStore } from '../lib/noStore';
import { decodeCursor, markCoinsSeen, readCoins } from './history';
import { buyPiece, readShop } from './shop';
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

coinsRouter.get('/me/shop', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  res.json(await readShop(req.userId!, new Date()));
});

// Never optimistic (spec §6.6): the app shows the piece only once this answers 200.
coinsRouter.post('/me/shop/purchases', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const result = await buyPiece(req.userId!, req.body, new Date());
  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json(result.body);
});
