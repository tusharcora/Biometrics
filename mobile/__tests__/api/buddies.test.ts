import { apiFetch } from '../../src/api/client';
import { buddyErrorCode, fetchBuddyPage, fetchBuddyWeek, fetchCode, redeemCode, sendSticker, unpair } from '../../src/api/buddies';

jest.mock('../../src/api/client');
const api = apiFetch as jest.Mock;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

beforeEach(() => api.mockReset());

it('reads the first page, and a later page by cursor', async () => {
  api.mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: 2, outgoingRequests: 1 });
  expect(await fetchBuddyPage()).toEqual({ buddies: [], nextCursor: null, incomingRequests: 2, outgoingRequests: 1 });
  expect(api).toHaveBeenLastCalledWith('/me/buddies');
  await fetchBuddyPage('a b');
  expect(api).toHaveBeenLastCalledWith('/me/buddies?cursor=a%20b');
});

it('only a bare 404 on the list probe is unavailable; a coded 404 or any other failure throws', async () => {
  api.mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }));
  expect(await fetchBuddyPage()).toBeNull();
  api.mockRejectedValue(Object.assign(new Error('gone'), { status: 404, code: 'not_found' }));
  await expect(fetchBuddyPage()).rejects.toThrow('gone');
  api.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
  await expect(fetchBuddyPage()).rejects.toThrow('boom');
  api.mockResolvedValue({ status: 'CONNECTED' });
  await expect(fetchBuddyPage()).rejects.toThrow('bad_buddies');
});

it('never makes up a request count the server did not send', async () => {
  api.mockResolvedValue({ buddies: [], nextCursor: null, outgoingRequests: 1 });
  await expect(fetchBuddyPage()).rejects.toThrow('bad_buddies');
  api.mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: '2', outgoingRequests: 1 });
  await expect(fetchBuddyPage()).rejects.toThrow('bad_buddies');
});

it("keeps a buddy's not_buddies as an error code, never null", async () => {
  api.mockRejectedValue(Object.assign(new Error('x'), { status: 403, code: 'not_buddies' }));
  const error = await fetchBuddyWeek('b1').catch((e: unknown) => e);
  expect(buddyErrorCode(error)).toBe('not_buddies');
  expect(buddyErrorCode(new Error('plain'))).toBeNull();
});

it('sends JSON with the right method and path', async () => {
  api.mockResolvedValue({ buddyId: 'b1' });
  await redeemCode('ABCD-EFGH');
  expect(api).toHaveBeenLastCalledWith('/me/buddies/code/redeem', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ code: 'ABCD-EFGH' }) });
  await sendSticker('b1', 'STAR');
  expect(api).toHaveBeenLastCalledWith('/me/buddies/b1/stickers', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ kind: 'STAR' }) });
  await unpair('b1');
  expect(api).toHaveBeenLastCalledWith('/me/buddies/b1', { method: 'DELETE', headers: JSON_HEADERS });
  api.mockResolvedValue({ code: null });
  expect(await fetchCode()).toBeNull();
});
