"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueSessionTokens = issueSessionTokens;
exports.verifyAccessToken = verifyAccessToken;
exports.refreshSession = refreshSession;
exports.revokeRefreshToken = revokeRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const client_1 = require("../db/client");
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function accessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret)
        throw new Error('JWT_ACCESS_SECRET is not set');
    return secret;
}
async function issueRefreshToken(userId) {
    const refreshToken = (0, crypto_1.randomUUID)() + (0, crypto_1.randomUUID)();
    await client_1.prisma.refreshToken.create({
        data: {
            userId,
            tokenHash: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
    });
    return refreshToken;
}
async function issueSessionTokens(userId) {
    const accessToken = jsonwebtoken_1.default.sign({ userId }, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    const refreshToken = await issueRefreshToken(userId);
    return { accessToken, refreshToken };
}
function verifyAccessToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, accessSecret());
    return { userId: payload.userId };
}
async function refreshSession(refreshToken) {
    const record = await client_1.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
    }
    await client_1.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return issueSessionTokens(record.userId);
}
async function revokeRefreshToken(refreshToken) {
    await client_1.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken) },
        data: { revokedAt: new Date() },
    });
}
//# sourceMappingURL=jwt.js.map