import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleIdToken } from '../../src/auth/googleAuth';

jest.mock('google-auth-library');

describe('verifyGoogleIdToken', () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  });

  it('returns email and provider user id from a valid ticket', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({ sub: 'google-user-456', email: 'user@gmail.com' }),
    });
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({ verifyIdToken }));

    const result = await verifyGoogleIdToken('fake-id-token');
    expect(result).toEqual({ email: 'user@gmail.com', providerUserId: 'google-user-456' });
  });
});
