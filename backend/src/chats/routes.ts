// Chats routes (spec 2026-10-07 social §8.5). Every /me/chats/:buddyId… route answers not_buddies (403) for a
// non-buddy, a malformed id, oneself or across a block — never a bare 404 (a bare 404 means an older server). GETs are
// never cached. Logs carry ids and event names only; no body is ever logged.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { requireBuddyId } from '../buddies/relations';
import { sendMessage } from './messages';

export const chatsRouter = Router();

chatsRouter.post('/me/chats/:buddyId/messages', requireAuth, buddyRoute(async (req, res) => {
  const buddyId = requireBuddyId(String(req.params.buddyId), req.userId!);
  res.status(201).json({ message: await sendMessage(req.userId!, buddyId, req.body, new Date()) });
}));
