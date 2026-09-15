import * as jose from 'jose';
import { verifyAppleIdentityToken } from '../../src/auth/appleAuth';

jest.mock('jose');

describe('verifyAppleIdentityToken', () => {
  beforeAll(() => {
    process.env.APPLE_BUNDLE_ID = 'com.example.biometrics';
  });

  it('returns email and provider user id from a valid token payload', async () => {
    (jose.createRemoteJWKSet as jest.Mock).mockReturnValue('mock-jwks');
    (jose.jwtVerify as jest.Mock).mockResolvedValue({
      payload: { sub: 'apple-user-123', email: 'user@icloud.com', aud: 'com.example.biometrics' },
    });

    const result = await verifyAppleIdentityToken('fake-identity-token');
    expect(result).toEqual({ email: 'user@icloud.com', providerUserId: 'apple-user-123' });
  });

  it('rejects a token with the wrong audience', async () => {
    (jose.createRemoteJWKSet as jest.Mock).mockReturnValue('mock-jwks');
    (jose.jwtVerify as jest.Mock).mockResolvedValue({
      payload: { sub: 'apple-user-123', email: 'user@icloud.com', aud: 'wrong-bundle-id' },
    });

    await expect(verifyAppleIdentityToken('fake-identity-token')).rejects.toThrow();
  });
});
