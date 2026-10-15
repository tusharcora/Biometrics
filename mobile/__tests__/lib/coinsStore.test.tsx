import { act, renderHook } from '@testing-library/react-native';
import { fetchCoins, fetchFirstWeek, postCoinsSeen, type CoinsDTO } from '../../src/api/coins';
import {
  getCoins, getFirstWeek, loadCoins, loadFirstWeek, loadMoreCoins, markCoinsSeen, resetCoins, setCoinBalance, useCoins,
} from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({
  fetchCoins: jest.fn(), postCoinsSeen: jest.fn(async () => undefined), fetchFirstWeek: jest.fn(),
  fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
const get = fetchCoins as jest.Mock;

const BODY = (over: Partial<CoinsDTO> = {}): CoinsDTO => ({
  balance: 120, today: { earned: 25, cap: 60 },
  events: [{ kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false }, { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false }],
  next: null, ...over,
});
const later = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  resetCoins();
});

it('loads the wallet, shares one read between loads started together, and keeps it when a read fails', async () => {
  get.mockResolvedValue(BODY());
  await Promise.all([loadCoins(), loadCoins()]);
  expect([get.mock.calls.length, getCoins()!.balance]).toEqual([1, 120]);
  get.mockRejectedValueOnce(new Error('offline'));
  await loadCoins();
  expect(getCoins()!.balance).toBe(120);
});

it('a read that started before a purchase never overwrites its balance (spec §16, ruling 33)', async () => {
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const read = loadCoins();
  setCoinBalance(30);
  d.resolve(BODY());
  await read;
  expect(getCoins()!.balance).toBe(30);
});

it('drops an answer that lands after sign-out', async () => {
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const read = loadCoins();
  resetCoins();
  d.resolve(BODY());
  await read;
  expect(getCoins()).toBeNull();
});

it('marks events seen up to `through` at once and tells the server', async () => {
  get.mockResolvedValue(BODY());
  await loadCoins();
  await markCoinsSeen('2026-11-11T06:30:00.000Z');
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false, true]);
  expect(postCoinsSeen).toHaveBeenCalledWith('2026-11-11T06:30:00.000Z');
});

it('appends the next page, and drops it when a newer read replaced the list meanwhile', async () => {
  get.mockResolvedValueOnce(BODY({ next: 'c1' }));
  await loadCoins();
  get.mockResolvedValueOnce(BODY({ events: [{ kind: 'recap', amount: 10, at: '2026-11-10T09:00:00.000Z', seen: true }], next: null }));
  await loadMoreCoins();
  expect([getCoins()!.events.length, getCoins()!.next, get.mock.calls[1]![0]]).toEqual([3, null, 'c1']);
  get.mockResolvedValueOnce(BODY({ next: 'c2' }));
  await loadCoins();
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const more = loadMoreCoins();
  setCoinBalance(5);
  d.resolve(BODY({ events: [], next: null }));
  await more;
  expect(getCoins()!.next).toBe('c2');
});

it('loads the first-week list and forgets it on sign-out', async () => {
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
  await loadFirstWeek();
  expect(getFirstWeek()).toEqual({ open: false });
  resetCoins();
  expect(getFirstWeek()).toBeNull();
});

it('useCoins follows the store', async () => {
  const { result } = renderHook(() => useCoins());
  expect(result.current).toBeNull();
  await act(async () => { setCoinBalance(9); });
  expect(result.current!.balance).toBe(9);
});
