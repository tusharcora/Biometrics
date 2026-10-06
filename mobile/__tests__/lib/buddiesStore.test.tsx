import { act, renderHook } from '@testing-library/react-native';
import { fetchBuddyPage } from '../../src/api/buddies';
import { getBuddiesState, refreshBuddies, resetBuddies, useBuddies } from '../../src/lib/buddiesStore';

jest.mock('../../src/api/buddies', () => ({ fetchBuddyPage: jest.fn() }));
const load = fetchBuddyPage as jest.Mock;
const PAGE = { buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 };

beforeEach(() => {
  load.mockReset();
  resetBuddies();
});

it('loads the first page once for callers that overlap, and publishes it to hooks', async () => {
  load.mockResolvedValue(PAGE);
  const { result } = renderHook(() => useBuddies());
  await act(async () => {
    await Promise.all([refreshBuddies(), refreshBuddies()]);
  });
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current).toEqual({ status: 'ready', page: PAGE });
});

it('a bare 404 is unavailable; a failure keeps the last good page, or is an error', async () => {
  load.mockResolvedValueOnce(null);
  await refreshBuddies();
  expect(getBuddiesState()).toEqual({ status: 'unavailable' });
  load.mockResolvedValueOnce(PAGE);
  await refreshBuddies();
  load.mockRejectedValueOnce(new Error('offline'));
  await refreshBuddies();
  expect(getBuddiesState()).toEqual({ status: 'ready', page: PAGE });
  resetBuddies();
  load.mockRejectedValueOnce(new Error('offline'));
  await refreshBuddies();
  expect(getBuddiesState()).toEqual({ status: 'error' });
});

it('a load that started before a reset never lands after it', async () => {
  let resolve!: (page: unknown) => void;
  load.mockReturnValue(new Promise((r) => { resolve = r; }));
  const pending = refreshBuddies();
  resetBuddies();
  resolve(PAGE);
  await pending;
  expect(getBuddiesState()).toEqual({ status: 'idle' });
});
