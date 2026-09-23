"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidWebhookAuthorization = isValidWebhookAuthorization;
const crypto_1 = require("crypto");
function isValidWebhookAuthorization(authorizationHeader) {
    if (!authorizationHeader)
        return false;
    const expected = process.env.GOOGLE_HEALTH_WEBHOOK_SECRET;
    if (!expected)
        throw new Error('GOOGLE_HEALTH_WEBHOOK_SECRET is not set');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(authorizationHeader);
    if (expectedBuf.length !== actualBuf.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(expectedBuf, actualBuf);
}
//# sourceMappingURL=webhookVerify.js.map