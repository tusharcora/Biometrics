import * as SecureStore from 'expo-secure-store';

let baseUrl = '';
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

// Carries the HTTP status so callers can tell "nothing there" (404) apart from
// a real failure, plus the server's own `error` code when it sent one: a status
// alone cannot separate two different 404s (coach disabled vs. a conversation
// that has since been retained away). The message format is unchanged.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Best effort: the body may be empty, HTML from a proxy, or already consumed.
// A failure to read it just means no code, never a different error.
async function errorCodeOf(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

async function apiErrorFor(res: Response, path: string): Promise<ApiError> {
  return new ApiError(res.status, `Request to ${path} failed with ${res.status}`, await errorCodeOf(res));
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

// Lets the auth layer find out that the stored session can no longer be used.
// The API client cannot import the auth context (the context imports this
// module), so it publishes the event and AuthProvider subscribes.
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to "the stored session was rejected for good". Returns an unsubscribe function. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

async function expireSession(): Promise<void> {
  // Failing to delete must not stop the listeners: the in-memory session is
  // what the navigator reads, and it has to go either way.
  await Promise.all([
    SecureStore.deleteItemAsync('accessToken'),
    SecureStore.deleteItemAsync('refreshToken'),
  ]).catch(() => undefined);
  sessionExpiredListeners.forEach((listener) => listener());
}

async function performRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    // A 4xx means the server REJECTED our refresh token: unknown, revoked or
    // expired -- for instance after the app is pointed at a different backend.
    // Retrying can never succeed, so end the session instead of stranding the
    // user on a screen that only shows an error. A 5xx (or a thrown network
    // error, which propagates untouched) is a transient failure and must not
    // sign anyone out.
    if (res.status >= 400 && res.status < 500) {
      await expireSession();
      throw new Error('Session expired, please sign in again');
    }
    throw new Error('Could not refresh your session, please try again');
  }
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
    if (!res.ok) throw await apiErrorFor(res, path);
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
  if (!res.ok) throw await apiErrorFor(res, path);
  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Permanently deletes the signed-in account and everything stored for it. The
// server answers 204 on success, 400 if the confirmation word is wrong and 401
// if the session is not valid. Once it succeeds the tokens are dead, so the
// caller must clear them locally rather than call the sign-out endpoint.
export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
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
