import * as SecureStore from 'expo-secure-store';
import { apiFetch, setBaseUrl } from '../../src/api/client';

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
});
