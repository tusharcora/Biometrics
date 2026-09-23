"use strict";
// Account deletion (App Store requirement; the coach spec's section 5 also
// assumes it). Two parts:
//
//   1. Best effort at Google, never blocking: delete the webhook subscription
//      and revoke the OAuth grant. Google being down, or the grant already
//      being revoked, must not leave the user unable to delete their account.
//   2. Local deletion of every row the user owns, in ONE transaction, then the
//      User row itself.
//
// USER_OWNED_MODELS is the single ordered list of tables that hold a user's
// data. Account deletion and the test-fixture purge (scripts/purgeTestFixtures.ts)
// both walk it, and a test introspects the Prisma schema to fail if a model
// with a `userId` column is ever missing from it, so a future table cannot
// silently outlive its user.
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_OWNED_MODELS = void 0;
exports.delegateFor = delegateFor;
exports.deleteOwnedRows = deleteOwnedRows;
exports.deleteUserAccount = deleteUserAccount;
const client_1 = require("../db/client");
const tokenCipher_1 = require("../crypto/tokenCipher");
const oauth_1 = require("../health/oauth");
const subscriber_1 = require("../health/subscriber");
/**
 * Every model that carries a `userId`, in an FK-safe delete order: children
 * before parents (CoachMessage references CoachConversation), and all of them
 * before the User row their foreign keys point at. Names are Prisma model names
 * as they appear in the schema.
 */
exports.USER_OWNED_MODELS = [
    'BiometricRecord',
    'SleepSession',
    'UserDailyFeatures',
    'BaselineSnapshot',
    'DailyScore',
    'ScoreInputFlag',
    'HabitLog',
    'HabitCheckIn',
    'HabitType',
    'HabitCorrelation',
    'CoachMessage',
    'CoachConversation',
    'CoachMemory',
    'CoachDigest',
    'CoachConsent',
    'PushToken',
    'RefreshToken',
    'HealthConnection',
];
/** The Prisma delegate for a model name (`CoachMessage` -> `client.coachMessage`). */
function delegateFor(client, model) {
    const key = (model.charAt(0).toLowerCase() + model.slice(1));
    return client[key];
}
/**
 * Deletes, in ONE transaction and in USER_OWNED_MODELS order, the rows of every
 * owned table matching `ownedWhere` and then the users matching `userWhere`.
 * Returns per-table counts.
 */
async function deleteOwnedRows(client, ownedWhere, userWhere) {
    const models = [...exports.USER_OWNED_MODELS, 'User'];
    const results = await client.$transaction(models.map((model) => delegateFor(client, model).deleteMany({ where: model === 'User' ? userWhere : ownedWhere })));
    const counts = {};
    models.forEach((model, i) => {
        counts[model] = results[i].count;
    });
    return counts;
}
const defaultDeps = {
    deleteSubscription: subscriber_1.deleteUserSubscription,
    revokeToken: oauth_1.revokeHealthToken,
    log: (message) => console.error(message),
};
// Only the error's own message is logged: ours carry an HTTP status, never a
// token. The token itself only ever exists in memory for the revoke call.
function describe(err) {
    return err instanceof Error ? err.message : 'unknown error';
}
/**
 * Deletes the user and everything they own. Idempotent: for an unknown user it
 * deletes nothing and does not throw.
 */
async function deleteUserAccount(userId, deps = {}) {
    const { deleteSubscription, revokeToken, log } = { ...defaultDeps, ...deps };
    let googleSubscriptionDeleted = false;
    let googleTokenRevoked = false;
    try {
        const conn = await client_1.prisma.healthConnection.findUnique({ where: { userId } });
        if (conn) {
            if (conn.webhookSubscriptionId) {
                try {
                    await deleteSubscription(conn.webhookSubscriptionId);
                    googleSubscriptionDeleted = true;
                }
                catch (err) {
                    log(`Account deletion: failed to delete Google Health subscription for user ${userId}: ${describe(err)}`);
                }
            }
            try {
                await revokeToken((0, tokenCipher_1.decryptToken)(conn.encryptedRefreshToken));
                googleTokenRevoked = true;
            }
            catch (err) {
                log(`Account deletion: failed to revoke Google token for user ${userId}: ${describe(err)}`);
            }
        }
    }
    catch (err) {
        log(`Account deletion: could not read the Google Health connection for user ${userId}: ${describe(err)}`);
    }
    const counts = await deleteOwnedRows(client_1.prisma, { userId }, { id: userId });
    return { googleSubscriptionDeleted, googleTokenRevoked, counts };
}
//# sourceMappingURL=deletion.js.map