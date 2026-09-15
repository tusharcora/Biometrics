import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import { prisma } from '../db/client';
import { SessionTokens } from '../types';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return secret;
}

async function issueRefreshToken(userId: string): Promise<string> {
  const refreshToken = randomUUID() + randomUUID();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return refreshToken;
}

export async function issueSessionTokens(userId: string): Promise<SessionTokens> {
  const accessToken = jwt.sign({ userId }, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = await issueRefreshToken(userId);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, accessSecret()) as { userId: string };
  return { userId: payload.userId };
}

export async function refreshSession(refreshToken: string): Promise<SessionTokens> {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return issueSessionTokens(record.userId);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken) },
    data: { revokedAt: new Date() },
  });
}
