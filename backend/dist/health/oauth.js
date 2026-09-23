"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAuthorizeUrl = buildAuthorizeUrl;
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.refreshHealthTokens = refreshHealthTokens;
exports.revokeHealthToken = revokeHealthToken;
const node_fetch_1 = __importDefault(require("node-fetch"));
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPES = [
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
    'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
    'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
].join(' ');
function config() {
    const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_HEALTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Google Health OAuth env vars are not fully configured');
    }
    return { clientId, clientSecret, redirectUri };
}
function buildAuthorizeUrl(state) {
    const { clientId, redirectUri } = config();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}
async function requestToken(body) {
    const { clientId, clientSecret } = config();
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    const res = await (0, node_fetch_1.default)(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Google token endpoint returned ${res.status}: ${errorBody}`);
    }
    const json = (await res.json());
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresIn: json.expires_in,
    };
}
async function exchangeCodeForTokens(code) {
    const { redirectUri } = config();
    return requestToken(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }));
}
async function refreshHealthTokens(refreshToken) {
    return requestToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }));
}
/**
 * Revokes a grant at Google (account deletion). Revoking the refresh token also
 * invalidates the access tokens minted from it. The error carries only the HTTP
 * status: the token is in the request body and must never reach a log.
 */
async function revokeHealthToken(refreshToken) {
    const res = await (0, node_fetch_1.default)(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }).toString(),
    });
    if (!res.ok) {
        throw new Error(`Google token revocation returned ${res.status}`);
    }
}
//# sourceMappingURL=oauth.js.map