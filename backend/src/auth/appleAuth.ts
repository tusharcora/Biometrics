import * as jose from 'jose';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<{ email: string; providerUserId: string }> {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!bundleId) throw new Error('APPLE_BUNDLE_ID is not set');

  const jwks = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  const { payload } = await jose.jwtVerify(identityToken, jwks, {
    issuer: 'https://appleid.apple.com',
  });

  // `aud` is `string | string[]` per the JWT spec, so an array containing the
  // bundle ID is a valid audience and must not be rejected.
  const audienceMatches = Array.isArray(payload.aud)
    ? payload.aud.includes(bundleId)
    : payload.aud === bundleId;
  if (!audienceMatches) {
    throw new Error('Apple identity token audience mismatch');
  }
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Apple identity token missing required claims');
  }
  // An unverified email must never be trusted as an identity signal.
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new Error('Apple identity token email is not verified');
  }
  return { email: payload.email, providerUserId: payload.sub };
}
