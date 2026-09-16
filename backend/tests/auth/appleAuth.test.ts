import * as jose from 'jose';
import { verifyAppleIdentityToken } from '../../src/auth/appleAuth';

jest.mock('jose');

describe('verifyAppleIdentityToken', () => {
  beforeAll(() => {
    process.env.APPLE_BUNDLE_ID = 'com.example.biometrics';
  });

  function mockPayload(payload: Record<string, unknown>) {
    (jose.createRemoteJWKSet as jest.Mock).mockReturnValue('mock-jwks');
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload });
  }

  it('returns email and provider user id from a valid token payload', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: 'com.example.biometrics',
      email_verified: true,
    });

    const result = await verifyAppleIdentityToken('fake-identity-token');
    expect(result).toEqual({ email: 'user@icloud.com', providerUserId: 'apple-user-123' });
  });

  it('rejects a token with the wrong audience', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: 'wrong-bundle-id',
      email_verified: true,
    });

    await expect(verifyAppleIdentityToken('fake-identity-token')).rejects.toThrow();
  });

  it('accepts an array-valued audience that contains the bundle id', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: ['some-other-client', 'com.example.biometrics'],
      email_verified: true,
    });

    const result = await verifyAppleIdentityToken('fake-identity-token');
    expect(result).toEqual({ email: 'user@icloud.com', providerUserId: 'apple-user-123' });
  });

  it('rejects an array-valued audience that does not contain the bundle id', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: ['some-other-client', 'yet-another-client'],
      email_verified: true,
    });

    await expect(verifyAppleIdentityToken('fake-identity-token')).rejects.toThrow();
  });

  it('rejects a token whose email is not verified', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: 'com.example.biometrics',
      email_verified: false,
    });

    await expect(verifyAppleIdentityToken('fake-identity-token')).rejects.toThrow(/not verified/i);
  });

  it('rejects a token with no email_verified claim at all', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: 'com.example.biometrics',
    });

    await expect(verifyAppleIdentityToken('fake-identity-token')).rejects.toThrow(/not verified/i);
  });

  // Apple is documented to serialise this claim as the string "true" in some
  // token versions, so both spellings must be honoured.
  it('accepts the string "true" spelling of email_verified', async () => {
    mockPayload({
      sub: 'apple-user-123',
      email: 'user@icloud.com',
      aud: 'com.example.biometrics',
      email_verified: 'true',
    });

    const result = await verifyAppleIdentityToken('fake-identity-token');
    expect(result.providerUserId).toBe('apple-user-123');
  });
});
