import * as SecureStore from 'expo-secure-store';

let baseUrl = '';
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

async function refreshAccessToken(): Promise<string> {
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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let accessToken = await SecureStore.getItemAsync('accessToken');
  const doFetch = (token: string | null) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    accessToken = await refreshAccessToken();
    res = await doFetch(accessToken);
  }
  if (!res.ok) throw new Error(`Request to ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}
