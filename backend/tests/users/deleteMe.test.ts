import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { deleteUserSubscription } from '../../src/health/subscriber';
import { revokeHealthToken } from '../../src/health/oauth';
import { connection } from '../../src/sync/queue';
import { countOwnedRows, createUserWithEmail, seedAllOwnedRows, totalRows } from './ownedData';

// No real Google calls: the route reaches Google only through these two.
jest.mock('../../src/health/subscriber');
jest.mock('../../src/health/oauth');

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

beforeEach(() => {
  (deleteUserSubscription as jest.Mock).mockReset().mockResolvedValue(undefined);
  (revokeHealthToken as jest.Mock).mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const newUser = () => createUserWithEmail(`delme-${randomUUID()}@example.com`);

describe('DELETE /me', () => {
  it('deletes the account and all its data, answering 204', async () => {
    const user = await newUser();
    await seedAllOwnedRows(user.id, { refreshToken: 'route-refresh-token', subscriptionId: 'route-sub' });
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .delete('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirm: 'DELETE' });

    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(totalRows(await countOwnedRows(user.id))).toBe(0);
    expect(deleteUserSubscription).toHaveBeenCalledWith('route-sub');
    expect(revokeHealthToken).toHaveBeenCalledWith('route-refresh-token');
  });

  it("does not touch another user's account or data", async () => {
    const user = await newUser();
    const other = await newUser();
    await seedAllOwnedRows(other.id);
    await issueSessionTokens(other.id);
    const before = await countOwnedRows(other.id);
    const { accessToken } = await issueSessionTokens(user.id);

    await request(createApp()).delete('/me').set('Authorization', `Bearer ${accessToken}`).send({ confirm: 'DELETE' }).expect(204);

    expect(await prisma.user.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(await countOwnedRows(other.id)).toEqual(before);
  });

  it('succeeds for a user with no Google connection, without calling Google', async () => {
    const user = await newUser();
    const { accessToken } = await issueSessionTokens(user.id);

    await request(createApp()).delete('/me').set('Authorization', `Bearer ${accessToken}`).send({ confirm: 'DELETE' }).expect(204);

    expect(deleteUserSubscription).not.toHaveBeenCalled();
    expect(revokeHealthToken).not.toHaveBeenCalled();
  });

  it('still answers 204 and deletes locally when Google fails', async () => {
    const user = await newUser();
    await seedAllOwnedRows(user.id);
    const { accessToken } = await issueSessionTokens(user.id);
    (deleteUserSubscription as jest.Mock).mockRejectedValue(new Error('Failed to delete Google Health subscription: 500'));
    (revokeHealthToken as jest.Mock).mockRejectedValue(new Error('Google token revocation returned 503'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(createApp())
      .delete('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirm: 'DELETE' });
    errors.mockRestore();

    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(totalRows(await countOwnedRows(user.id))).toBe(0);
  });

  it.each([
    ['no body', undefined],
    ['an empty object', {}],
    ['the wrong word', { confirm: 'delete' }],
    ['a near miss', { confirm: 'DELETE ' }],
    ['a non-string', { confirm: true }],
    ['a different field', { confirmation: 'DELETE' }],
    ['an array', ['DELETE']],
  ])('rejects %s with 400 and deletes nothing', async (_label, body) => {
    const user = await newUser();
    await seedAllOwnedRows(user.id);
    const { accessToken } = await issueSessionTokens(user.id);
    const before = await countOwnedRows(user.id);

    const req = request(createApp()).delete('/me').set('Authorization', `Bearer ${accessToken}`);
    const res = await (body === undefined ? req : req.send(body as object));

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await countOwnedRows(user.id)).toEqual(before);
    expect(deleteUserSubscription).not.toHaveBeenCalled();
    expect(revokeHealthToken).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON body (the word alone) with 400 and deletes nothing', async () => {
    const user = await newUser();
    const { accessToken } = await issueSessionTokens(user.id);

    const res = await request(createApp())
      .delete('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'text/plain')
      .send('DELETE');

    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(createApp()).delete('/me').send({ confirm: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage bearer token with 401', async () => {
    const res = await request(createApp()).delete('/me').set('Authorization', 'Bearer nope').send({ confirm: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('kills the session: the old access token and refresh token are rejected afterwards', async () => {
    const user = await newUser();
    const { accessToken, refreshToken } = await issueSessionTokens(user.id);
    const app = createApp();
    // The token works before deletion.
    await request(app).put('/me/timezone').set('Authorization', `Bearer ${accessToken}`).send({ timezone: 'UTC' }).expect(200);

    await request(app).delete('/me').set('Authorization', `Bearer ${accessToken}`).send({ confirm: 'DELETE' }).expect(204);

    const after = await request(app).put('/me/timezone').set('Authorization', `Bearer ${accessToken}`).send({ timezone: 'UTC' });
    expect(after.status).toBe(401);
    expect((await request(app).delete('/me').set('Authorization', `Bearer ${accessToken}`).send({ confirm: 'DELETE' })).status).toBe(401);
    expect((await request(app).post('/auth/refresh').send({ refreshToken })).status).toBe(401);
  });
});
