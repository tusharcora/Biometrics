"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleIdToken = verifyGoogleIdToken;
const google_auth_library_1 = require("google-auth-library");
async function verifyGoogleIdToken(idToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId)
        throw new Error('GOOGLE_CLIENT_ID is not set');
    const client = new google_auth_library_1.OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
        throw new Error('Google ID token missing required claims');
    }
    // Workspace custom domains can issue tokens for unverified addresses; trusting
    // one would let an attacker sign into an account that already owns the email.
    if (payload.email_verified !== true) {
        throw new Error('Google ID token email is not verified');
    }
    return { email: payload.email, providerUserId: payload.sub };
}
//# sourceMappingURL=googleAuth.js.map