import * as SecureStore from 'expo-secure-store';

let baseUrl = '';
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Skip both attaching the session token and the 401-retry-refresh. Use for
   * the /auth/* calls, which establish a session rather than consuming one.
   */
  skipAuth?: boolean;
}

// Refresh tokens are single-use and rotated server-side, so two requests that
// 401 at the same time must not each start their own refresh: the second would
// present an already-revoked token, fail, and sign the user out for no reason.
// Callers that arrive while a refresh is in flight await that same promise.
let inFlightRefresh: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Session expired, please sign in again');
  const tokens = await res.json();
  await SecureStore.setItemAsync('accessToken', tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
  return tokens.accessToken;
}

async function refreshAccessToken(): Promise<string> {
  if (!inFlightRefresh) {
    // Cleared in a finally so a failed refresh does not poison later attempts.
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, ...requestInit } = options;

  if (skipAuth) {
    const res = await fetch(`${baseUrl}${path}`, requestInit);
    if (!res.ok) throw new Error(`Request to ${path} failed with ${res.status}`);
    return res.json() as Promise<T>;
  }

  let accessToken = await SecureStore.getItemAsync('accessToken');
  const doFetch = (token: string | null) =>
    fetch(`${baseUrl}${path}`, {
      ...requestInit,
      headers: { ...requestInit.headers, Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    accessToken = await refreshAccessToken();
    res = await doFetch(accessToken);
  }
  if (!res.ok) throw new Error(`Request to ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

// Tells the backend which IANA zone to use for civil-date bucketing (sleep
// rollups, habit days). A 400 from the server means the zone name was invalid.
export function updateTimezone(timezone: string): Promise<{ timezone: string }> {
  return apiFetch<{ timezone: string }>('/me/timezone', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timezone }),
  });
}
