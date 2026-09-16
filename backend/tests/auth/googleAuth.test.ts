import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleIdToken } from '../../src/auth/googleAuth';

jest.mock('google-auth-library');

describe('verifyGoogleIdToken', () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  });

  function mockPayload(payload: Record<string, unknown>) {
    const verifyIdToken = jest.fn().mockResolvedValue({ getPayload: () => payload });
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({ verifyIdToken }));
  }

  it('returns email and provider user id from a valid ticket', async () => {
    mockPayload({ sub: 'google-user-456', email: 'user@gmail.com', email_verified: true });

    const result = await verifyGoogleIdToken('fake-id-token');
    expect(result).toEqual({ email: 'user@gmail.com', providerUserId: 'google-user-456' });
  });

  it('rejects a ticket whose email is not verified', async () => {
    mockPayload({ sub: 'google-user-456', email: 'user@gmail.com', email_verified: false });

    await expect(verifyGoogleIdToken('fake-id-token')).rejects.toThrow(/not verified/i);
  });

  it('rejects a ticket with no email_verified claim at all', async () => {
    mockPayload({ sub: 'google-user-456', email: 'user@gmail.com' });

    await expect(verifyGoogleIdToken('fake-id-token')).rejects.toThrow(/not verified/i);
  });
});
