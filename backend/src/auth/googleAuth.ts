import { OAuth2Client } from 'google-auth-library';

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ email: string; providerUserId: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google ID token missing required claims');
  }
  // Workspace custom domains can issue tokens for unverified addresses; trusting
  // one would let an attacker sign into an account that already owns the email.
  if (payload.email_verified !== true) {
    throw new Error('Google ID token email is not verified');
  }
  return { email: payload.email, providerUserId: payload.sub };
}
