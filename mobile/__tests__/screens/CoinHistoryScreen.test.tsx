import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchCoins, postCoinsSeen } from '../../src/api/coins';
import { getCoins, resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';
import { CoinHistoryScreen } from '../../src/screens/CoinHistoryScreen';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

const BODY = (over = {}) => ({
  balance: 360, today: { earned: 40, cap: 60 },
  events: [{ kind: 'sleep_goal', amount: 20, at: new Date().toISOString(), seen: true }, { kind: 'checkin', amount: 5, at: new Date().toISOString(), seen: true }],
  next: null, ...over,
});

async function open(params?: object) {
  mockParams = params;
  const s = render(<CoinHistoryScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows today against the cap with its bar, the rows, How to earn, and the way to the shop (spec §6.7)', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(BODY());
  const s = await open();
  expect(s.getByText('Earned today · 40 of 60').props.accessibilityLabel).toBe('Earned today, 40 of 60');
  expect(s.getByTestId('history-today-bar').props.style).toEqual(expect.objectContaining({ width: '67%' }));
  expect(s.getByText('A daily cap keeps it about habits, not grinding.')).toBeTruthy();
  expect(s.getAllByTestId('history-row')).toHaveLength(2);
  expect(s.getByText('Sleep goal +20')).toBeTruthy();
  fireEvent.press(s.getByTestId('history-shop'));
  expect(mockNav.navigate).toHaveBeenCalledWith('CoinShop');
  fireEvent.press(s.getByTestId('history-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('opened from the shop, it has no button back to the shop', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(BODY());
  expect((await open({ from: 'shop' })).queryByTestId('history-shop')).toBeNull();
});

it('loads the next page with the cursor', async () => {
  (fetchCoins as jest.Mock).mockResolvedValueOnce(BODY({ next: 'c1' })).mockResolvedValueOnce(BODY({ events: [{ kind: 'recap', amount: 10, at: new Date().toISOString(), seen: true }], next: null }));
  const s = await open();
  await act(async () => { fireEvent.press(s.getByTestId('history-more')); });
  expect([(fetchCoins as jest.Mock).mock.calls[1]![0], s.getAllByTestId('history-row').length, s.queryByTestId('history-more')]).toEqual(['c1', 3, null]);
});

it('a failed read offers Try again', async () => {
  (fetchCoins as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(BODY());
  const s = await open();
  await act(async () => { fireEvent.press(s.getByTestId('history-retry')); });
  expect(s.getAllByTestId('history-row')).toHaveLength(2);
});

it('reads a capped row aloud without a "·", and opening it never marks coins seen (PF-COPY, PF-F13)', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(BODY({ events: [{ kind: 'recap', amount: 0, at: new Date().toISOString(), seen: false }] }));
  const s = await open();
  const row = s.getByTestId('history-row');
  expect(row.props.accessibilityLabel).toMatch(/^Read your weekly recap, Today, \d\d:\d\d, plus 0 coins, daily cap reached$/);
  expect(String(s.getByText('+0 · daily cap').props.className).split(' ')).toContain('tabular-nums');
  expect(postCoinsSeen).not.toHaveBeenCalled();
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false]);
});

it('a balance known only from a purchase shows the loading state, not 0 of 60 and "No coins yet", until a read lands', async () => {
  setCoinBalance(140);
  let land!: (body: object) => void;
  (fetchCoins as jest.Mock).mockReturnValueOnce(new Promise((r) => { land = r; }));
  const s = await open();
  expect([s.queryByTestId('history-loading') !== null, s.queryByTestId('history-today'), s.queryByTestId('history-empty')]).toEqual([true, null, null]);
  await act(async () => { land(BODY({ balance: 140 })); });
  expect([s.queryByTestId('history-loading'), s.getAllByTestId('history-row').length]).toEqual([null, 2]);
});

it('a balance known only from a purchase and a failed read shows the error with Try again', async () => {
  setCoinBalance(140);
  (fetchCoins as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(BODY());
  const s = await open();
  expect([s.queryByTestId('history-failed') !== null, s.queryByTestId('history-today')]).toEqual([true, null]);
  await act(async () => { fireEvent.press(s.getByTestId('history-retry')); });
  expect(s.getAllByTestId('history-row')).toHaveLength(2);
});

it('Load more is busy while it reads, and says so when the read fails; tapping again retries', async () => {
  let fail!: (e: Error) => void;
  (fetchCoins as jest.Mock)
    .mockResolvedValueOnce(BODY({ next: 'c1' }))
    .mockReturnValueOnce(new Promise((_r, j) => { fail = j; }))
    .mockResolvedValueOnce(BODY({ events: [{ kind: 'recap', amount: 10, at: new Date().toISOString(), seen: true }], next: null }));
  const s = await open();
  await act(async () => { fireEvent.press(s.getByTestId('history-more')); });
  expect(s.getByTestId('history-more').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  fireEvent.press(s.getByTestId('history-more'));
  expect(fetchCoins).toHaveBeenCalledTimes(2);
  await act(async () => { fail(new Error('offline')); });
  expect(s.getByTestId('history-more-failed')).toHaveTextContent("Couldn't load more just now. Tap Load more to try again.");
  expect(s.getByTestId('history-more').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
  await act(async () => { fireEvent.press(s.getByTestId('history-more')); });
  expect([s.getAllByTestId('history-row').length, s.queryByTestId('history-more'), s.queryByTestId('history-more-failed')]).toEqual([3, null, null]);
});
