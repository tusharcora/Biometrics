import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { prisma } from '../db/client';

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  let userId: string;
  try {
    ({ userId } = verifyAccessToken(header.slice('Bearer '.length)));
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  // Access tokens are stateless JWTs that outlive the account for up to their
  // TTL, so a deleted user is rejected by looking the user up rather than by
  // trusting the signature alone. (One primary-key read per request.) A
  // database failure is a 500 via Express, not a 401: it is not the caller's fault.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.userId = userId;
  next();
}
