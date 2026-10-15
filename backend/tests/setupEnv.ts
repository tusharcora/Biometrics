// Loaded by Jest before any test module (jest.config.js `setupFiles`), because
// the default Better Auth instance reads these when src/auth/auth.ts is first
// imported.
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-at-least-32-chars';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.APPLE_BUNDLE_ID ??= 'com.tusharcora.biometrics';
process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
// The coins launch (coins/sources.ts coinsConfig) sits in 2100 under Jest, so a suite that saves a room or checks in
// writes no coin rows; coin tests set coinsConfig.launchedAt (or pass launchedAt) themselves. Always overridden, so a
// dev shell's COINS_LAUNCHED_AT never leaks into a run.
process.env.COINS_LAUNCHED_AT = '2100-01-01T00:00:00.000Z';
