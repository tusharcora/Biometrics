import request from 'supertest';
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { createTestApp, fakeIdToken } from '../helpers/auth';

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

const ORIGIN = { 'expo-origin': 'biometrics://' };

function cookieFrom(res: request.Response): string {
  return (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
}

async function googleSignIn(app: Parameters<typeof request>[0], email: string, userAgent: string) {
  const token = fakeIdToken({ iss: 'https://accounts.google.com', aud: 'test-google-client-id', sub: `g-${email}`, email, email_verified: true });
  const res = await request(app).post('/auth/sign-in/social').set('User-Agent', userAgent).send({ provider: 'google', idToken: { token } });
  return cookieFrom(res);
}

describe('session management', () => {
  it('lists every signed-in device and revokes the others', async () => {
    const { app } = createTestApp();
    const email = `devices-${randomUUID()}@example.com`;
    const phone = await googleSignIn(app, email, 'Biometrics/1 iPhone');
    const tablet = await googleSignIn(app, email, 'Biometrics/1 iPad');

    const list = await request(app).get('/auth/list-sessions').set('Cookie', phone);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);

    const revoke = await request(app).post('/auth/revoke-other-sessions').set(ORIGIN).set('Cookie', phone).send({});
    expect(revoke.status).toBe(200);
    expect((await request(app).get('/auth/get-session').set('Cookie', tablet)).body).toBeNull();
    expect((await request(app).get('/auth/get-session').set('Cookie', phone)).body?.user?.email).toBe(email);
  });

  it('revokes one session by token', async () => {
    const { app } = createTestApp();
    const email = `one-${randomUUID()}@example.com`;
    const a = await googleSignIn(app, email, 'A');
    const b = await googleSignIn(app, email, 'B');
    const sessions = (await request(app).get('/auth/list-sessions').set('Cookie', a)).body as Array<{ token: string; userAgent: string }>;
    const bToken = sessions.find((s) => s.userAgent === 'B')!.token;
    await request(app).post('/auth/revoke-session').set(ORIGIN).set('Cookie', a).send({ token: bToken });
    expect((await request(app).get('/auth/get-session').set('Cookie', b)).body).toBeNull();
  });

  it('refuses to unlink the last sign-in method', async () => {
    const { app } = createTestApp();
    const email = `last-${randomUUID()}@example.com`;
    const cookie = await googleSignIn(app, email, 'A');
    const account = await prisma.account.findFirstOrThrow({ where: { user: { email } } });
    const res = await request(app).post('/auth/unlink-account').set(ORIGIN).set('Cookie', cookie)
      .send({ providerId: 'google', accountId: account.accountId });
    expect(res.status).toBe(400);
    expect(await prisma.account.count({ where: { user: { email } } })).toBe(1);
  });
});
