import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { isValidTimeZone } from '../biometrics/civilDate';
import { recomputeAllSleepRollups } from '../biometrics/repository';
import { prisma } from '../db/client';
import { deleteUserAccount } from './deletion';

export const usersRouter = Router();

/**
 * The client reports its IANA zone (Intl.DateTimeFormat().resolvedOptions()
 * .timeZone) at connect time, again on launch when it changes, and via a
 * Settings override. The zone decides which local civil date each sleep
 * session's end instant belongs to, so a change re-derives the SLEEP rollups.
 */
usersRouter.put('/me/timezone', requireAuth, async (req: AuthedRequest, res) => {
  const timezone: unknown = req.body?.timezone;
  if (!isValidTimeZone(timezone)) {
    res.status(400).json({ error: 'timezone must be a valid IANA time zone name, e.g. "America/Los_Angeles"' });
    return;
  }

  const userId = req.userId!;
  const result = await prisma.user.updateMany({ where: { id: userId }, data: { timezone } });
  if (result.count === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Rebuilt even when the zone is unchanged: rollups are derived so this is
  // cheap and idempotent, and it means a request that saved the zone but
  // failed mid-recompute is repaired by simply retrying the same PUT, instead
  // of the retry being a no-op that leaves rollups keyed under the old zone.
  await recomputeAllSleepRollups(userId);

  res.json({ timezone });
});

/**
 * In-app account deletion (App Store requirement). Irreversible, so the body
 * must be exactly { "confirm": "DELETE" }: a bare DELETE (a retried request, a
 * misrouted client) deletes nothing. Everything the user owns goes, and their
 * tokens stop working (see requireAuth and deleteUserAccount).
 */
usersRouter.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  if (req.body?.confirm !== 'DELETE') {
    res.status(400).json({ error: 'Send {"confirm":"DELETE"} to delete your account' });
    return;
  }
  await deleteUserAccount(req.userId!);
  res.status(204).send();
});
