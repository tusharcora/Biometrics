import * as SecureStore from 'expo-secure-store';
import { apiFetch, setBaseUrl, updateTimezone } from '../../src/api/client';

jest.mock('expo-secure-store');

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

beforeEach(() => {
  setBaseUrl('https://api.example.com');
  fetchMock.mockReset();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(key === 'accessToken' ? 'old-access' : 'refresh-token'),
  );
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('apiFetch', () => {
  it('attaches the stored access token to the request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'ok' }) });

    const result = await apiFetch('/me/biometrics');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/me/biometrics',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer old-access' }) }),
    );
    expect(result).toEqual({ data: 'ok' });
  });

  it('refreshes the token once and retries after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'ok-after-refresh' }) });

    const result = await apiFetch('/me/biometrics');

    expect(result).toEqual({ data: 'ok-after-refresh' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'new-access');
  });

  // Refresh tokens are single-use and rotated server-side. Two concurrent
  // refreshes would have the second present an already-revoked token, fail, and
  // sign the user out for no reason.
  it('coalesces concurrent refreshes into a single /auth/refresh call', async () => {
    let resolveRefresh: (value: any) => void = () => {};
    const refreshResponse = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    // Every data request 401s until the (single) refresh resolves.
    let refreshed = false;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) return refreshResponse;
      if (!refreshed) return Promise.resolve({ ok: false, status: 401 });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: 'ok' }) });
    });

    const inFlight = Promise.all([apiFetch('/me/biometrics'), apiFetch('/me/connection')]);

    // Let both initial requests 401 and reach the refresh path.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    refreshed = true;
    resolveRefresh({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    });

    await inFlight;

    const refreshCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      url.endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('starts a fresh refresh after a previous one failed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(apiFetch('/me/biometrics')).rejects.toThrow(/Session expired/);

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'recovered' }) });

    // The failed refresh must not have left a poisoned in-flight promise.
    await expect(apiFetch('/me/biometrics')).resolves.toEqual({ data: 'recovered' });
  });
});

describe('apiFetch with skipAuth', () => {
  it('does not attach an Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    await apiFetch('/auth/apple', { method: 'POST', skipAuth: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers?.Authorization).toBeUndefined();
    // skipAuth must not leak through as a fetch option.
    expect(init.skipAuth).toBeUndefined();
  });

  // A 401 from /auth/apple means "bad identity token", not "expired session".
  // Retrying it via refresh turned a failed sign-in into "Session expired".
  it('does not attempt a token refresh on a 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(apiFetch('/auth/apple', { method: 'POST', skipAuth: true })).rejects.toThrow(
      /failed with 401/,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([url]: [string]) => url.endsWith('/auth/refresh')),
    ).toBe(false);
  });
});

describe('updateTimezone', () => {
  it('PUTs the zone as JSON to /me/timezone with the auth token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ timezone: 'Asia/Tokyo' }) });

    const result = await updateTimezone('Asia/Tokyo');

    expect(result).toEqual({ timezone: 'Asia/Tokyo' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me/timezone');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ timezone: 'Asia/Tokyo' }));
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer old-access', 'Content-Type': 'application/json' }),
    );
  });

  it('rejects when the server returns 400 for an invalid zone', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(updateTimezone('Nope/Zone')).rejects.toThrow(/failed with 400/);
  });
});
