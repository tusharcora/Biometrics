"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTokenRefreshSweep = runTokenRefreshSweep;
const client_1 = require("../db/client");
const oauth_1 = require("../health/oauth");
const subscriber_1 = require("../health/subscriber");
const tokenCipher_1 = require("../crypto/tokenCipher");
const tokenUpdate_1 = require("./tokenUpdate");
const REFRESH_LOOKAHEAD_MS = 60 * 60 * 1000; // refresh anything expiring within the next hour
async function runTokenRefreshSweep() {
    const expiringSoon = await client_1.prisma.healthConnection.findMany({
        where: {
            status: 'CONNECTED',
            tokenExpiresAt: { lt: new Date(Date.now() + REFRESH_LOOKAHEAD_MS) },
        },
    });
    for (const conn of expiringSoon) {
        // Only a failure of the refresh itself means the connection is genuinely
        // dead. A failure of the DB write afterwards is a transient infrastructure
        // problem and must not disconnect a perfectly healthy connection.
        let tokens;
        try {
            const refreshToken = (0, tokenCipher_1.decryptToken)(conn.encryptedRefreshToken);
            tokens = await (0, oauth_1.refreshHealthTokens)(refreshToken);
        }
        catch (err) {
            console.error(`Google Health token refresh failed for connection ${conn.id}`, err);
            await client_1.prisma.healthConnection.update({
                where: { id: conn.id },
                data: { status: 'DISCONNECTED' },
            });
            if (conn.webhookSubscriptionId) {
                try {
                    await (0, subscriber_1.deleteUserSubscription)(conn.webhookSubscriptionId);
                }
                catch (deleteErr) {
                    console.error(`Failed to delete Google Health subscription ${conn.webhookSubscriptionId}`, deleteErr);
                }
            }
            continue;
        }
        try {
            // refreshedTokenUpdateData only touches encryptedRefreshToken when Google
            // actually returned a new refresh token (see its doc comment).
            await client_1.prisma.healthConnection.update({
                where: { id: conn.id },
                data: (0, tokenUpdate_1.refreshedTokenUpdateData)(tokens),
            });
        }
        catch (err) {
            // The refresh succeeded, so the connection is fine; surface the write
            // failure instead of silently marking the user disconnected.
            console.error(`Failed to persist refreshed Google Health tokens for connection ${conn.id}`, err);
            throw err;
        }
    }
}
//# sourceMappingURL=tokenRefreshJob.js.map