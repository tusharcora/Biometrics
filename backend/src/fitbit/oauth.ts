import fetch from 'node-fetch';
import { FitbitTokenResponse } from '../types';

const AUTHORIZE_URL = 'https://www.fitbit.com/oauth2/authorize';
const TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const SCOPES = ['heartrate', 'sleep', 'activity'].join(' ');

function config() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Fitbit OAuth env vars are not fully configured');
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface FitbitTokenApiResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

async function requestToken(body: URLSearchParams): Promise<FitbitTokenResponse> {
  const { clientId, clientSecret } = config();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Fitbit token endpoint returned ${res.status}`);
  }

  const json = (await res.json()) as FitbitTokenApiResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    fitbitUserId: json.user_id,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<FitbitTokenResponse> {
  const { redirectUri } = config();
  return requestToken(
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  );
}

export async function refreshFitbitTokens(refreshToken: string): Promise<FitbitTokenResponse> {
  return requestToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }));
}
