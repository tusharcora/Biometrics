import { Router } from 'express';
import { verifyAppleIdentityToken } from './appleAuth';
import { verifyGoogleIdToken } from './googleAuth';
import { issueSessionTokens, refreshSession, revokeRefreshToken } from './jwt';
import { findOrCreateUserByProvider } from '../users/repository';

export const authRouter = Router();

authRouter.post('/auth/apple', async (req, res) => {
  try {
    const { email, providerUserId } = await verifyAppleIdentityToken(req.body.identityToken);
    const user = await findOrCreateUserByProvider(email, 'APPLE', providerUserId);
    res.json(await issueSessionTokens(user.id));
  } catch {
    res.status(401).json({ error: 'Invalid Apple identity token' });
  }
});

authRouter.post('/auth/google', async (req, res) => {
  try {
    const { email, providerUserId } = await verifyGoogleIdToken(req.body.idToken);
    const user = await findOrCreateUserByProvider(email, 'GOOGLE', providerUserId);
    res.json(await issueSessionTokens(user.id));
  } catch {
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
});

authRouter.post('/auth/refresh', async (req, res) => {
  try {
    res.json(await refreshSession(req.body.refreshToken));
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

authRouter.post('/auth/signout', async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.status(204).send();
});
