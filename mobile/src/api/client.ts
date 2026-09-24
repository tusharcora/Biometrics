import { authClient } from '../auth/authClient';

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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookie = await authClient.getCookie();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    // The session travels as an explicit Cookie header from SecureStore; the
    // platform cookie jar must not add or override anything.
    credentials: 'omit',
    headers: { ...options.headers, Cookie: cookie },
  });
  if (res.status === 401) {
    // Sessions slide on the server and there is no refresh step: a 401 means
    // the session is gone (revoked, expired, account deleted). Sign out -- which
    // clears the stored cookie and flips useSession() to null -- unless the
    // user has already signed in again since this request started.
    if ((await authClient.getCookie()) === cookie) {
      await authClient.signOut().catch(() => undefined);
    }
    throw await apiErrorFor(res, path);
  }
  if (!res.ok) throw await apiErrorFor(res, path);
  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Permanently deletes the signed-in account and everything stored for it. The
// server answers 204 on success, 400 if the confirmation word is wrong and 401
// if the session is not valid. Once it succeeds the session is dead, so the
// caller must clear it locally (clearSession) rather than sign out through the
// server.
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
