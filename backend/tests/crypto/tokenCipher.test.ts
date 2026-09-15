import { encryptToken, decryptToken } from '../../src/crypto/tokenCipher';

describe('tokenCipher', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('round-trips a plaintext token', () => {
    const ciphertext = encryptToken('my-fitbit-access-token');
    expect(ciphertext).not.toContain('my-fitbit-access-token');
    expect(decryptToken(ciphertext)).toBe('my-fitbit-access-token');
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptToken('same-value');
    const b = encryptToken('same-value');
    expect(a).not.toBe(b);
  });
});
