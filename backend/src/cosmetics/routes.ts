// KIP's room endpoints (spec 2026-10-14 KIP's room §5; spec 2026-10-15 free-build §12: the layout save, its error
// codes and the 32 KB cap, and POST /me/room/welcomed for the first-week welcome card, §11.1). All need a session and
// answer private, no-store. Nothing here is health data; nothing is logged with the user's id.
import express, { Router, type RequestHandler } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { noStore } from '../lib/noStore';
import { MAX_BODY_BYTES, markSeen, markWelcomed, readCosmetics, saveCosmetics } from './loadout';

export const cosmeticsRouter = Router();

const saveJson = express.json({
  limit: MAX_BODY_BYTES,
  verify: (req, _res, buf) => {
    (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
  },
});

/**
 * The save's own body parser (plan ruling 14), mounted in app.ts ahead of the global one, which then skips the parsed
 * request: a body over 32 KB is never read whole and answers the house 400 invalid_body, not the global 413.
 */
export const saveBodyParser: RequestHandler = (req, res, next) => {
  saveJson(req, res, (err?: unknown) => {
    if ((err as { type?: unknown } | undefined)?.type === 'entity.too.large') {
      noStore(res);
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    next(err);
  });
};

cosmeticsRouter.get('/me/cosmetics', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  res.json(await readCosmetics(req.userId!, new Date()));
});

cosmeticsRouter.put('/me/cosmetics', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const raw = (req as AuthedRequest & { rawBody?: Buffer }).rawBody;
  const result = await saveCosmetics(req.userId!, req.body, new Date(), raw?.length);
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

cosmeticsRouter.post('/me/room/welcomed', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  await markWelcomed(req.userId!, new Date());
  res.status(204).end();
});
