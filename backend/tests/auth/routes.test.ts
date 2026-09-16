import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import * as appleAuth from '../../src/auth/appleAuth';
import * as googleAuth from '../../src/auth/googleAuth';

jest.mock('../../src/auth/appleAuth');
jest.mock('../../src/auth/googleAuth');

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth routes', () => {
  it('signs in with Google and returns session tokens', async () => {
    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: 'google-user@example.com',
      providerUserId: 'g-1',
    });

    const res = await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('refreshes a session', async () => {
    (appleAuth.verifyAppleIdentityToken as jest.Mock).mockResolvedValue({
      email: 'apple-user@example.com',
      providerUserId: 'a-1',
    });
    const signIn = await request(createApp()).post('/auth/apple').send({ identityToken: 'fake' });

    const res = await request(createApp())
      .post('/auth/refresh')
      .send({ refreshToken: signIn.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects a refresh token after sign-out', async () => {
    (appleAuth.verifyAppleIdentityToken as jest.Mock).mockResolvedValue({
      email: 'apple-user-2@example.com',
      providerUserId: 'a-2',
    });
    const signIn = await request(createApp()).post('/auth/apple').send({ identityToken: 'fake' });

    await request(createApp()).post('/auth/signout').send({ refreshToken: signIn.body.refreshToken });
    const res = await request(createApp())
      .post('/auth/refresh')
      .send({ refreshToken: signIn.body.refreshToken });

    expect(res.status).toBe(401);
  });

  it('returns 401 when the Google ID token is invalid', async () => {
    (googleAuth.verifyGoogleIdToken as jest.Mock).mockRejectedValue(new Error('bad token'));

    const res = await request(createApp()).post('/auth/google').send({ idToken: 'forged' });

    expect(res.status).toBe(401);
  });

  it('treats the same email signing in via Apple and via Google as two separate accounts', async () => {
    const sharedEmail = `shared-${randomUUID()}@example.com`;

    (appleAuth.verifyAppleIdentityToken as jest.Mock).mockResolvedValue({
      email: sharedEmail,
      providerUserId: `apple-${randomUUID()}`,
    });
    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: sharedEmail,
      providerUserId: `google-${randomUUID()}`,
    });

    const appleRes = await request(createApp()).post('/auth/apple').send({ identityToken: 'fake' });
    const googleRes = await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    expect(appleRes.status).toBe(200);
    expect(googleRes.status).toBe(200);

    const users = await prisma.user.findMany({ where: { email: sharedEmail } });
    expect(users).toHaveLength(2);
    expect(new Set(users.map((u) => u.authProvider))).toEqual(new Set(['APPLE', 'GOOGLE']));
    // Two genuinely distinct accounts, not one merged row.
    expect(users[0].id).not.toBe(users[1].id);
  });

  it('returns the same account when the same provider identity signs in twice', async () => {
    const providerUserId = `google-${randomUUID()}`;
    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: `repeat-${randomUUID()}@example.com`,
      providerUserId,
    });

    await request(createApp()).post('/auth/google').send({ idToken: 'fake' });
    await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    const users = await prisma.user.findMany({ where: { authProvider: 'GOOGLE', providerUserId } });
    expect(users).toHaveLength(1);
  });

  it('updates the stored email when the provider reports a new one for the same identity', async () => {
    const providerUserId = `google-${randomUUID()}`;
    const newEmail = `changed-${randomUUID()}@example.com`;

    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: `original-${randomUUID()}@example.com`,
      providerUserId,
    });
    await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: newEmail,
      providerUserId,
    });
    await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    const user = await prisma.user.findUnique({
      where: { authProvider_providerUserId: { authProvider: 'GOOGLE', providerUserId } },
    });
    expect(user?.email).toBe(newEmail);
  });

  it('returns 500 (not 401) when sign-in fails after a valid Google token', async () => {
    (googleAuth.verifyGoogleIdToken as jest.Mock).mockResolvedValue({
      email: 'google-user-2@example.com',
      providerUserId: 'g-2',
    });
    const upsertSpy = jest.spyOn(prisma.user, 'upsert').mockRejectedValueOnce(new Error('db down'));

    const res = await request(createApp()).post('/auth/google').send({ idToken: 'fake' });

    expect(res.status).toBe(500);
    upsertSpy.mockRestore();
  });
});
