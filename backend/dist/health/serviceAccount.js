"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceAccountToken = getServiceAccountToken;
const google_auth_library_1 = require("google-auth-library");
async function getServiceAccountToken() {
    const auth = new google_auth_library_1.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token) {
        throw new Error('Failed to obtain service account access token');
    }
    return typeof token === 'string' ? token : token.token;
}
//# sourceMappingURL=serviceAccount.js.map