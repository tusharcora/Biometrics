import { AuthError, messageFor, unwrap } from '../../src/auth/authErrors';

describe('unwrap', () => {
  it('returns data when there is no error', async () => {
    await expect(unwrap(Promise.resolve({ data: { ok: 1 }, error: null }))).resolves.toEqual({ ok: 1 });
  });

  it('throws an AuthError carrying the Better Auth code and status', async () => {
    const err = await unwrap(Promise.resolve({ data: null, error: { code: 'EMAIL_NOT_VERIFIED', status: 403, message: 'Email not verified' } })).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe('EMAIL_NOT_VERIFIED');
    expect(err.status).toBe(403);
  });
});

describe('messageFor', () => {
  it.each([
    ['INVALID_EMAIL_OR_PASSWORD', 'That email and password do not match.'],
    ['EMAIL_NOT_VERIFIED', 'Confirm your email first. We sent you a link.'],
    ['PASSWORD_TOO_SHORT', 'Use at least 8 characters for your password.'],
  ])('maps %s to a friendly message', (code, message) => {
    expect(messageFor(new AuthError(code, 'raw', 400))).toBe(message);
  });

  it('falls back to a generic message for anything else', () => {
    expect(messageFor(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
