// Buddies endpoints (spec 2026-10-06 buddies). Specific /me/buddies/<word> paths are registered
// before /me/buddies/:buddyId. Logs carry ids and event names only.

import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { RATE_LIMITS } from '../lib/rateLimit';
import { createCode, getActiveCode, redeemCode } from './codes';
import { BuddyError, buddyRoute, limitOrThrow } from './errors';
import { getIdentity, isHandleAvailable, updateIdentity } from './handles';
import { checkDisplayName, checkHandle } from './identity';
import { confirmMoodNotice, getSharing, parseSharingPatch, recordSharingConsent, updateSharing } from './sharing';

export const buddiesRouter = Router();

buddiesRouter.get('/me/buddies/me', requireAuth, buddyRoute(async (req, res) => {
  const identity = await getIdentity(req.userId!);
  if (!identity) throw new BuddyError('not_found');
  res.set('Cache-Control', 'private, no-store');
  res.json(identity);
}));

buddiesRouter.get('/me/handle/availability', requireAuth, buddyRoute(async (req, res) => {
  await limitOrThrow(RATE_LIMITS.handle, req.userId!);
  const check = checkHandle(req.query.handle);
  if (!check.ok) throw new BuddyError('invalid_handle', { problem: check.problem });
  res.json({ handle: check.handle, available: await isHandleAvailable(req.userId!, check.handle, new Date()) });
}));

buddiesRouter.put('/me/handle', requireAuth, buddyRoute(async (req, res) => {
  await limitOrThrow(RATE_LIMITS.handle, req.userId!);
  const body = (req.body ?? {}) as { handle?: unknown; displayName?: unknown };
  const patch: { handle?: string; displayName?: string } = {};
  if (body.handle !== undefined) {
    const check = checkHandle(body.handle);
    if (!check.ok) throw new BuddyError('invalid_handle', { problem: check.problem });
    patch.handle = check.handle;
  }
  if (body.displayName !== undefined) {
    const check = checkDisplayName(body.displayName);
    if (!check.ok) throw new BuddyError('invalid_display_name', { problem: check.problem });
    patch.displayName = check.displayName;
  }
  if (Object.keys(patch).length === 0) throw new BuddyError('setup_incomplete');
  res.json(await updateIdentity(req.userId!, patch, new Date()));
}));

buddiesRouter.post('/me/buddies/mood-notice', requireAuth, buddyRoute(async (req, res) => {
  await confirmMoodNotice(req.userId!, new Date());
  res.json({ moodNoticeSeen: true });
}));

buddiesRouter.get('/me/buddies/sharing', requireAuth, buddyRoute(async (req, res) => {
  const sharing = await getSharing(req.userId!);
  if (!sharing) throw new BuddyError('not_found');
  res.json(sharing);
}));

buddiesRouter.put('/me/buddies/sharing', requireAuth, buddyRoute(async (req, res) => {
  const patch = parseSharingPatch(req.body);
  if (!patch) throw new BuddyError('invalid_settings');
  res.json(await updateSharing(req.userId!, patch));
}));

buddiesRouter.post('/me/buddies/sharing/consent', requireAuth, buddyRoute(async (req, res) => {
  res.json(await recordSharingConsent(req.userId!, (req.body as { version?: unknown } | undefined)?.version, new Date()));
}));

buddiesRouter.get('/me/buddies/code', requireAuth, buddyRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json((await getActiveCode(req.userId!, new Date())) ?? { code: null });
}));

buddiesRouter.post('/me/buddies/code', requireAuth, buddyRoute(async (req, res) => {
  const made = await createCode(req.userId!, new Date());
  res.set('Cache-Control', 'private, no-store');
  res.json(made);
}));

buddiesRouter.post('/me/buddies/code/redeem', requireAuth, buddyRoute(async (req, res) => {
  res.json(await redeemCode(req.userId!, (req.body as { code?: unknown } | undefined)?.code, new Date()));
}));
