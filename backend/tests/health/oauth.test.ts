import nock from 'nock';
import { buildAuthorizeUrl, exchangeCodeForTokens, refreshHealthTokens } from '../../src/health/oauth';

beforeAll(() => {
  process.env.GOOGLE_HEALTH_CLIENT_ID = 'client-123.apps.googleusercontent.com';
  process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'secret-456';
  process.env.GOOGLE_HEALTH_REDIRECT_URI = 'https://app.example.com/health/callback';
});

afterEach(() => nock.cleanAll());

describe('buildAuthorizeUrl', () => {
  it('includes client id, redirect uri, the three googlehealth scopes, and state', () => {
    const url = buildAuthorizeUrl('state-abc');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-123.apps.googleusercontent.com');
    expect(url).toContain(encodeURIComponent('https://app.example.com/health/callback'));
    expect(url).toContain('state=state-abc');
    expect(url).toContain(encodeURIComponent('googlehealth.activity_and_fitness.readonly'));
    expect(url).toContain(encodeURIComponent('googlehealth.health_metrics_and_measurements.readonly'));
    expect(url).toContain(encodeURIComponent('googlehealth.sleep.readonly'));
  });
});

describe('exchangeCodeForTokens', () => {
  it('exchanges an auth code for tokens via Google\'s token endpoint', async () => {
    nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3599 });

    const tokens = await exchangeCodeForTokens('auth-code-1');
    expect(tokens).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 3599 });
  });
});

describe('refreshHealthTokens', () => {
  it('exchanges a refresh token for new tokens', async () => {
    nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, { access_token: 'access-2', expires_in: 3599 });

    const tokens = await refreshHealthTokens('refresh-1');
    expect(tokens.accessToken).toBe('access-2');
  });
});
