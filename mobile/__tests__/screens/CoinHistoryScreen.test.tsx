import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchCoins, postCoinsSeen } from '../../src/api/coins';
import { resetCoins } from '../../src/lib/coins/coinsStore';
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
});
