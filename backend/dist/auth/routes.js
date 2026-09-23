"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const appleAuth_1 = require("./appleAuth");
const googleAuth_1 = require("./googleAuth");
const jwt_1 = require("./jwt");
const repository_1 = require("../users/repository");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/auth/apple', async (req, res) => {
    let identity;
    try {
        identity = await (0, appleAuth_1.verifyAppleIdentityToken)(req.body.identityToken);
    }
    catch {
        res.status(401).json({ error: 'Invalid Apple identity token' });
        return;
    }
    try {
        const user = await (0, repository_1.findOrCreateUserByProvider)(identity.email, 'APPLE', identity.providerUserId);
        res.json(await (0, jwt_1.issueSessionTokens)(user.id));
    }
    catch {
        res.status(500).json({ error: 'Failed to complete sign-in' });
    }
});
exports.authRouter.post('/auth/google', async (req, res) => {
    let identity;
    try {
        identity = await (0, googleAuth_1.verifyGoogleIdToken)(req.body.idToken);
    }
    catch {
        res.status(401).json({ error: 'Invalid Google ID token' });
        return;
    }
    try {
        const user = await (0, repository_1.findOrCreateUserByProvider)(identity.email, 'GOOGLE', identity.providerUserId);
        res.json(await (0, jwt_1.issueSessionTokens)(user.id));
    }
    catch {
        res.status(500).json({ error: 'Failed to complete sign-in' });
    }
});
exports.authRouter.post('/auth/refresh', async (req, res) => {
    try {
        res.json(await (0, jwt_1.refreshSession)(req.body.refreshToken));
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});
exports.authRouter.post('/auth/signout', async (req, res) => {
    await (0, jwt_1.revokeRefreshToken)(req.body.refreshToken);
    res.status(204).send();
});
//# sourceMappingURL=routes.js.map