import nock from 'nock';
import { buildAuthorizeUrl, exchangeCodeForTokens, refreshFitbitTokens } from '../../src/fitbit/oauth';

beforeAll(() => {
  process.env.FITBIT_CLIENT_ID = 'client-123';
  process.env.FITBIT_CLIENT_SECRET = 'secret-456';
  process.env.FITBIT_REDIRECT_URI = 'https://app.example.com/fitbit/callback';
});

afterEach(() => nock.cleanAll());

describe('buildAuthorizeUrl', () => {
  it('includes client id, redirect uri, scopes, and state', () => {
    const url = buildAuthorizeUrl('state-abc');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain(encodeURIComponent('https://app.example.com/fitbit/callback'));
    expect(url).toContain('state=state-abc');
  });
});

describe('exchangeCodeForTokens', () => {
  it('exchanges an auth code for tokens', async () => {
    nock('https://api.fitbit.com')
      .post('/oauth2/token')
      .reply(200, {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 28800,
        user_id: 'fitbit-user-1',
      });

    const tokens = await exchangeCodeForTokens('auth-code-1');
    expect(tokens).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 28800,
      fitbitUserId: 'fitbit-user-1',
    });
  });
});

describe('refreshFitbitTokens', () => {
  it('exchanges a refresh token for new tokens', async () => {
    nock('https://api.fitbit.com')
      .post('/oauth2/token')
      .reply(200, {
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        expires_in: 28800,
        user_id: 'fitbit-user-1',
      });

    const tokens = await refreshFitbitTokens('refresh-1');
    expect(tokens.accessToken).toBe('access-2');
  });
});
