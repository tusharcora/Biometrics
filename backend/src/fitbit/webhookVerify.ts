import { createHmac, timingSafeEqual } from 'crypto';

export function isValidVerificationCode(verify: string): boolean {
  return verify === process.env.FITBIT_VERIFY_CODE;
}

export function isValidWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  if (!clientSecret) throw new Error('FITBIT_CLIENT_SECRET is not set');

  const expected = createHmac('sha1', clientSecret).update(rawBody).digest();
  const actual = Buffer.from(signatureHeader, 'base64');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
