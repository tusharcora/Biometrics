"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const middleware_1 = require("../auth/middleware");
const civilDate_1 = require("../biometrics/civilDate");
const repository_1 = require("../biometrics/repository");
const queue_1 = require("../scoring/queue");
const client_1 = require("../db/client");
const deletion_1 = require("./deletion");
exports.usersRouter = (0, express_1.Router)();
/**
 * The client reports its IANA zone (Intl.DateTimeFormat().resolvedOptions()
 * .timeZone) at connect time, again on launch when it changes, and via a
 * Settings override. The zone decides which local civil date each sleep
 * session's end instant belongs to, so a change re-derives the SLEEP rollups.
 */
exports.usersRouter.put('/me/timezone', middleware_1.requireAuth, async (req, res) => {
    const timezone = req.body?.timezone;
    if (!(0, civilDate_1.isValidTimeZone)(timezone)) {
        res.status(400).json({ error: 'timezone must be a valid IANA time zone name, e.g. "America/Los_Angeles"' });
        return;
    }
    const userId = req.userId;
    const result = await client_1.prisma.user.updateMany({ where: { id: userId }, data: { timezone } });
    if (result.count === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    // Rebuilt even when the zone is unchanged: rollups are derived so this is
    // cheap and idempotent, and it means a request that saved the zone but
    // failed mid-recompute is repaired by simply retrying the same PUT, instead
    // of the retry being a no-op that leaves rollups keyed under the old zone.
    const rekeyed = await (0, repository_1.recomputeAllSleepRollups)(userId);
    // Scores are derived from the rollups that just moved, so they are stale the
    // moment the zone changes. Enqueued, not computed inline: a long history must
    // not make this request slow, and a failure here must not fail a time zone
    // change the user already made (the nightly sweep is the backstop).
    for (const date of rekeyed) {
        await (0, queue_1.enqueueScoreCompute)(userId, date).catch((err) => console.error(`Failed to enqueue a score recompute for ${date} after a time zone change`, err));
    }
    res.json({ timezone });
});
/**
 * In-app account deletion (App Store requirement). Irreversible, so the body
 * must be exactly { "confirm": "DELETE" }: a bare DELETE (a retried request, a
 * misrouted client) deletes nothing. Everything the user owns goes, and their
 * tokens stop working (see requireAuth and deleteUserAccount).
 */
exports.usersRouter.delete('/me', middleware_1.requireAuth, async (req, res) => {
    if (req.body?.confirm !== 'DELETE') {
        res.status(400).json({ error: 'Send {"confirm":"DELETE"} to delete your account' });
        return;
    }
    await (0, deletion_1.deleteUserAccount)(req.userId);
    res.status(204).send();
});
//# sourceMappingURL=routes.js.map