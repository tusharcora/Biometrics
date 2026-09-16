import { Router } from 'express';
import { verifyAppleIdentityToken } from './appleAuth';
import { verifyGoogleIdToken } from './googleAuth';
import { issueSessionTokens, refreshSession, revokeRefreshToken } from './jwt';
import { findOrCreateUserByProvider } from '../users/repository';

export const authRouter = Router();

authRouter.post('/auth/apple', async (req, res) => {
  let identity;
  try {
    identity = await verifyAppleIdentityToken(req.body.identityToken);
  } catch {
    res.status(401).json({ error: 'Invalid Apple identity token' });
    return;
  }
  try {
    const user = await findOrCreateUserByProvider(identity.email, 'APPLE', identity.providerUserId);
    res.json(await issueSessionTokens(user.id));
  } catch {
    res.status(500).json({ error: 'Failed to complete sign-in' });
  }
});

authRouter.post('/auth/google', async (req, res) => {
  let identity;
  try {
    identity = await verifyGoogleIdToken(req.body.idToken);
  } catch {
    res.status(401).json({ error: 'Invalid Google ID token' });
    return;
  }
  try {
    const user = await findOrCreateUserByProvider(identity.email, 'GOOGLE', identity.providerUserId);
    res.json(await issueSessionTokens(user.id));
  } catch {
    res.status(500).json({ error: 'Failed to complete sign-in' });
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
