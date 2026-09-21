import * as SecureStore from 'expo-secure-store';
import { ApiError, deleteAccount, setBaseUrl } from '../../src/api/client';

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
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('deleteAccount', () => {
  it('sends an authenticated DELETE /me with the confirmation body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: jest.fn() });

    await deleteAccount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ confirm: 'DELETE' });
    expect(init.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer old-access' }),
    );
  });

  it('resolves to undefined on 204 without parsing a body', async () => {
    const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json });

    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('surfaces the HTTP status as an ApiError on a 400', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    const err = await deleteAccount().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
  });

  it('surfaces the HTTP status as an ApiError on a 500', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const err = await deleteAccount().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });

  it('lets a network failure propagate as-is (not an ApiError)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    const err = await deleteAccount().catch((e) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});
