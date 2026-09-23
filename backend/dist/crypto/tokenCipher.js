"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const crypto_1 = require("crypto");
function getKey() {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw)
        throw new Error('TOKEN_ENCRYPTION_KEY is not set');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32)
        throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
    return key;
}
function encryptToken(plaintext) {
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}
function decryptToken(encoded) {
    const raw = Buffer.from(encoded, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
//# sourceMappingURL=tokenCipher.js.map