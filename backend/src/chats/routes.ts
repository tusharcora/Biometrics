// Chats routes (spec 2026-10-07 social §8.5). Every /me/chats/:buddyId… route answers not_buddies (403) for a
// non-buddy, a malformed id, oneself or across a block — never a bare 404 (a bare 404 means an older server). GETs are
// never cached. Logs carry ids and event names only; no body is ever logged.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { BuddyError, buddyRoute } from '../buddies/errors';
import { requireBuddyId } from '../buddies/relations';
import { clearReaction, listThread, markRead, sendMessage, setReaction, unsendMessage } from './messages';
import { getChatSettings, parseChatSettingsPatch, touchPresence, updateChatSettings } from './presence';

export const chatsRouter = Router();

chatsRouter.post('/me/chats/:buddyId/messages', requireAuth, buddyRoute(async (req, res) => {
  const buddyId = requireBuddyId(String(req.params.buddyId), req.userId!);
  res.status(201).json({ message: await sendMessage(req.userId!, buddyId, req.body, new Date()) });
}));

chatsRouter.get('/me/chats/settings', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json(await getChatSettings(req.userId!));
}));

chatsRouter.put('/me/chats/settings', requireAuth, buddyRoute(async (req, res) => {
  const patch = parseChatSettingsPatch(req.body);
  if (!patch) throw new BuddyError('invalid_settings');
  res.set('Cache-Control', 'private, no-store');
  res.json(await updateChatSettings(req.userId!, patch));
}));

// Never rate-limited: at most one write a minute per user (touchPresence).
chatsRouter.post('/me/presence', requireAuth, buddyRoute(async (req, res) => {
  await touchPresence(req.userId!, new Date());
  res.status(204).end();
}));

chatsRouter.get('/me/chats/:buddyId/messages', requireAuth, buddyRoute(async (req, res) => {
  const buddyId = requireBuddyId(String(req.params.buddyId), req.userId!);
  res.set('Cache-Control', 'private, no-store');
  res.json(await listThread(req.userId!, buddyId, req.query.before, new Date()));
}));

chatsRouter.post('/me/chats/:buddyId/read', requireAuth, buddyRoute(async (req, res) => {
  await markRead(req.userId!, requireBuddyId(String(req.params.buddyId), req.userId!), new Date());
  res.status(204).end();
}));

// Never rate-limited (a delete never fails closed).
chatsRouter.delete('/me/chats/:buddyId/messages/:messageId', requireAuth, buddyRoute(async (req, res) => {
  await unsendMessage(req.userId!, requireBuddyId(String(req.params.buddyId), req.userId!), String(req.params.messageId), new Date());
  res.status(204).end();
}));

chatsRouter.put('/me/chats/:buddyId/messages/:messageId/reaction', requireAuth, buddyRoute(async (req, res) => {
  const buddyId = requireBuddyId(String(req.params.buddyId), req.userId!);
  res.json(await setReaction(req.userId!, buddyId, String(req.params.messageId), (req.body as { kind?: unknown } | undefined)?.kind, new Date()));
}));

// Never rate-limited (a delete never fails closed).
chatsRouter.delete('/me/chats/:buddyId/messages/:messageId/reaction', requireAuth, buddyRoute(async (req, res) => {
  await clearReaction(req.userId!, requireBuddyId(String(req.params.buddyId), req.userId!), String(req.params.messageId));
  res.status(204).end();
}));
