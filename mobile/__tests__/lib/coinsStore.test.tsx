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

it('a read the server answered before it applied a mark-seen keeps those events seen, so coins land once (spec §16)', async () => {
  get.mockResolvedValue(BODY());
  await loadCoins();
  await markCoinsSeen('2026-11-11T07:12:00.000Z');
  get.mockResolvedValueOnce(BODY({ events: [{ kind: 'steps', amount: 15, at: '2026-11-11T08:00:00.000Z', seen: false }, ...BODY().events] }));
  await loadCoins();
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false, true, true]);
  // Sign-out forgets it: the next account's events are its own.
  resetCoins();
  get.mockResolvedValueOnce(BODY());
  await loadCoins();
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false, false]);
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

it('shares one first-week read between loads started together', async () => {
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
  await Promise.all([loadFirstWeek(), loadFirstWeek()]);
  expect((fetchFirstWeek as jest.Mock).mock.calls.length).toBe(1);
});

it('a first-week read that started before a purchase never lands after it (ruling T9-FIX)', async () => {
  (fetchFirstWeek as jest.Mock).mockResolvedValueOnce({ open: false });
  await loadFirstWeek();
  const d = later<unknown>();
  (fetchFirstWeek as jest.Mock).mockReturnValueOnce(d.promise);
  const read = loadFirstWeek();
  setCoinBalance(30);
  d.resolve({ open: true, day: 2, done: 0, tasks: [], next: { tier: 2, coins: 300, streak: 7 } });
  await read;
  expect(getFirstWeek()).toEqual({ open: false });
  // A load after the purchase reads afresh rather than sharing the dropped one.
  (fetchFirstWeek as jest.Mock).mockResolvedValueOnce({ open: false, fresh: 1 });
  await loadFirstWeek();
  expect((fetchFirstWeek as jest.Mock).mock.calls.length).toBe(3);
});

it('marking coins seen does not drop a first-week read (seen is not part of the list)', async () => {
  const d = later<unknown>();
  (fetchFirstWeek as jest.Mock).mockReturnValueOnce(d.promise);
  const read = loadFirstWeek();
  await markCoinsSeen('2026-11-11T06:30:00.000Z');
  d.resolve({ open: false });
  await read;
  expect(getFirstWeek()).toEqual({ open: false });
});

it('drops a first-week answer that lands after sign-out', async () => {
  const d = later<unknown>();
  (fetchFirstWeek as jest.Mock).mockReturnValueOnce(d.promise);
  const read = loadFirstWeek();
  resetCoins();
  d.resolve({ open: false });
  await read;
  expect(getFirstWeek()).toBeNull();
});

it('marking coins seen while a read is in flight drops that read and reads again, so the newer coins still land once (final review M1)', async () => {
  get.mockResolvedValueOnce(BODY());
  await loadCoins();
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const read = loadCoins();
  const mark = markCoinsSeen('2026-11-11T07:12:00.000Z');
  // The re-read carries an earn the dropped read would have caught up on.
  const steps = { kind: 'steps' as const, amount: 15, at: '2026-11-11T08:00:00.000Z', seen: false };
  get.mockResolvedValueOnce(BODY({ balance: 135, events: [steps, ...BODY().events] }));
  d.resolve(BODY({ balance: 135, events: [steps, ...BODY().events] }));
  await read;
  await mark;
  await new Promise((r) => setTimeout(r, 0));
  expect(get).toHaveBeenCalledTimes(3);
  expect(getCoins()!.balance).toBe(135);
  // The marked events stay seen (seenThrough); only the new earn is left to land.
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false, true, true]);
});

it('marking coins seen with no read in flight reads nothing more', async () => {
  get.mockResolvedValueOnce(BODY());
  await loadCoins();
  await markCoinsSeen('2026-11-11T07:12:00.000Z');
  await new Promise((r) => setTimeout(r, 0));
  expect(get).toHaveBeenCalledTimes(1);
});

it('a fresh coins load never shares an older read, and that read\'s answer is dropped', async () => {
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const older = loadCoins();
  get.mockResolvedValueOnce(BODY({ balance: 130 }));
  await loadCoins({ fresh: true });
  d.resolve(BODY({ balance: 120 }));
  await older;
  expect([get.mock.calls.length, getCoins()!.balance]).toEqual([2, 130]);
});

describe('a first-week list that opens or ticks a row reads the coins again (final review I1, PF-F3)', () => {
  const tasks = (done: string[]) => ['checkin', 'place', 'sleep', 'fern', 'cheer', 'recap', 'streak7'].map((key) => ({ key, done: done.includes(key), reward: 5 }));
  const week = (done: string[]) => ({ open: true, day: 1, done: done.length, tasks: tasks(done), next: { tier: 2, coins: 600, streak: 14 } });
  const place = { kind: 'firstweek' as const, amount: 10, at: '2026-11-11T09:00:00.000Z', seen: false };
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('a P1 user\'s first open: the coins read ran before day 1 was set, so the +10 comes from the second, fresh read', async () => {
    // GET /me/coins answers before GET /me/firstweek has written day 1, so it pays no bonus.
    get.mockResolvedValueOnce(BODY({ events: [] }));
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce(week(['place']));
    get.mockResolvedValueOnce(BODY({ balance: 130, events: [place] }));
    await Promise.all([loadCoins(), loadFirstWeek()]);
    await settle();
    expect(get).toHaveBeenCalledTimes(2);
    expect(getCoins()!.balance).toBe(130);
    expect(getCoins()!.events).toEqual([place]);
  });

  it('the fresh read drops the parallel one even when that one answers last', async () => {
    const d = later<CoinsDTO>();
    get.mockReturnValueOnce(d.promise);
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce(week(['place']));
    get.mockResolvedValueOnce(BODY({ balance: 130, events: [place] }));
    const coins = loadCoins();
    await loadFirstWeek();
    await settle();
    d.resolve(BODY({ events: [] }));
    await coins;
    expect(getCoins()!.events).toEqual([place]);
  });

  it('reads again when a row ticks, and not for a list that is closed or unchanged', async () => {
    get.mockResolvedValue(BODY());
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce({ open: false });
    await loadFirstWeek();
    await settle();
    expect(get).toHaveBeenCalledTimes(0);
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce(week(['checkin']));
    await loadFirstWeek();
    await settle();
    expect(get).toHaveBeenCalledTimes(1);
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce(week(['checkin']));
    await loadFirstWeek();
    await settle();
    expect(get).toHaveBeenCalledTimes(1);
    (fetchFirstWeek as jest.Mock).mockResolvedValueOnce(week(['checkin', 'place']));
    await loadFirstWeek();
    await settle();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

it('useCoins follows the store', async () => {
  const { result } = renderHook(() => useCoins());
  expect(result.current).toBeNull();
  await act(async () => { setCoinBalance(9); });
  expect(result.current!.balance).toBe(9);
});
