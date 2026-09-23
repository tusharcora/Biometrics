"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIdentity = getIdentity;
exports.registerUserSubscription = registerUserSubscription;
exports.deleteUserSubscription = deleteUserSubscription;
const node_fetch_1 = __importDefault(require("node-fetch"));
const serviceAccount_1 = require("./serviceAccount");
const SUBSCRIBER_ID = 'biometrics-subscriber';
function projectNumber() {
    const value = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
    if (!value)
        throw new Error('GOOGLE_CLOUD_PROJECT_NUMBER is not set');
    return value;
}
async function getIdentity(userAccessToken) {
    const res = await (0, node_fetch_1.default)('https://health.googleapis.com/v4/users/me/identity', {
        headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    if (!res.ok) {
        throw new Error(`Failed to resolve Google Health identity: ${res.status}`);
    }
    const json = (await res.json());
    return { healthUserId: json.healthUserId };
}
async function registerUserSubscription(healthUserId) {
    const token = await (0, serviceAccount_1.getServiceAccountToken)();
    const url = `https://health.googleapis.com/v4/projects/${projectNumber()}/subscribers/${SUBSCRIBER_ID}/subscriptions`;
    const res = await (0, node_fetch_1.default)(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // Confirmed live: all four subscribe successfully with this exact
        // casing. `heart-rate-variability` (kebab-case) was the fix for a real
        // 400 -- the API rejects the camelCase `heartRateVariability` value
        // here even though that same string is the correct `dataType` on the
        // *webhook notification payload* (a different field entirely).
        body: JSON.stringify({
            user: `users/${healthUserId}`,
            dataTypes: ['steps', 'sleep', 'heart-rate', 'heart-rate-variability'],
        }),
    });
    if (!res.ok) {
        throw new Error(`Failed to create Google Health subscription: ${res.status}`);
    }
    const json = (await res.json());
    const parts = json.name.split('/');
    const subscriptionId = parts[parts.length - 1];
    if (!subscriptionId) {
        throw new Error('Unexpected subscription name format from Google Health API');
    }
    return subscriptionId;
}
async function deleteUserSubscription(subscriptionId) {
    const token = await (0, serviceAccount_1.getServiceAccountToken)();
    const url = `https://health.googleapis.com/v4/projects/${projectNumber()}/subscribers/${SUBSCRIBER_ID}/subscriptions/${subscriptionId}`;
    const res = await (0, node_fetch_1.default)(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error(`Failed to delete Google Health subscription: ${res.status}`);
    }
}
//# sourceMappingURL=subscriber.js.map