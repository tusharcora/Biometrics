import { createHmac } from 'crypto';
import { isValidVerificationCode, isValidWebhookSignature } from '../../src/fitbit/webhookVerify';

beforeAll(() => {
  process.env.FITBIT_VERIFY_CODE = 'expected-verify-code';
  process.env.FITBIT_CLIENT_SECRET = 'client-secret';
});

describe('isValidVerificationCode', () => {
  it('accepts the configured verify code', () => {
    expect(isValidVerificationCode('expected-verify-code')).toBe(true);
  });

  it('rejects any other code', () => {
    expect(isValidVerificationCode('wrong-code')).toBe(false);
  });
});

describe('isValidWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify([{ collectionType: 'sleep' }]));
    const signature = createHmac('sha1', 'client-secret').update(body).digest('base64');
    expect(isValidWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a body with a mismatched signature', () => {
    const body = Buffer.from(JSON.stringify([{ collectionType: 'sleep' }]));
    expect(isValidWebhookSignature(body, 'bogus-signature')).toBe(false);
  });

  it('rejects a missing signature header', () => {
    const body = Buffer.from('[]');
    expect(isValidWebhookSignature(body, undefined)).toBe(false);
  });
});
