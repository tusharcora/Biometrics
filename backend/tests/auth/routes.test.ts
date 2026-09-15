import request from 'supertest';
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
});
