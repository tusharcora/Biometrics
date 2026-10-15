import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchFirstWeek, type FirstWeekDTO } from '../../src/api/coins';
import { FirstWeekCard } from '../../src/components/coins/FirstWeekCard';
import { loadFirstWeek, resetCoins } from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

const OPEN: FirstWeekDTO = {
  open: true, day: 4, done: 4,
  tasks: [
    { key: 'checkin', done: true, reward: 5 }, { key: 'place', done: true, reward: 10 }, { key: 'sleep', done: true, reward: 20 },
    { key: 'fern', done: true, reward: -40 }, { key: 'cheer', done: false, reward: 2 }, { key: 'recap', done: false, reward: 10 },
    { key: 'streak7', done: false, reward: 25 },
  ],
  next: { tier: 2, coins: 600, streak: 14 },
};

async function card(dto: FirstWeekDTO) {
  (fetchFirstWeek as jest.Mock).mockResolvedValue(dto);
  await act(async () => { await loadFirstWeek(); });
  return render(<FirstWeekCard />);
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows nothing until the list is read, and nothing once it is gone (spec §11.2)', async () => {
  expect(render(<FirstWeekCard />).queryByTestId('first-week')).toBeNull();
  expect((await card({ open: false })).queryByTestId('first-week')).toBeNull();
});

it('shows the day, what is done, each row\'s reward (the two bonuses marked), and the next size (C7)', async () => {
  const s = await card(OPEN);
  expect(s.getByText('Day 4 of 7 · 4 of 7 done').props.accessibilityLabel).toBe('First week, day 4 of 7, 4 of 7 done');
  expect(s.getByTestId('first-week-place')).toHaveTextContent(/Place your first piece\+10 bonus/);
  expect(s.getByTestId('first-week-fern')).toHaveTextContent(/Get a fern in the coin shop−40/);
  expect(s.getByTestId('first-week-streak7').props.accessibilityLabel).toBe('7 check-ins in a row, not yet, plus 25 coins bonus');
  expect(s.getByTestId('first-week-fern').props.accessibilityLabel).toBe('Get a fern in the coin shop, done, costs 40 coins');
  // The cheer row is shown in P2 and ticks once P4 writes cheers (plan ruling 24).
  expect(s.getByTestId('first-week-cheer').props.accessibilityLabel).toBe("Cheer a buddy's room, not yet, plus 2 coins");
  for (const t of OPEN.tasks) expect(s.getByTestId(`first-week-${t.key}`).props.accessibilityLabel).not.toMatch(/·|−/);
  // The next size's dashed rows are drawn on Room sizes only, so the line names it (plan ruling 15, ruling PF-F12).
  const next = s.getByText('Next: 8 × 8 · 600 coins and a 14-day check-in streak. See the next size in Room sizes.');
  expect(next.props.accessibilityLabel).toBe('Next: 8 by 8, 600 coins and a 14-day check-in streak. See the next size in Room sizes.');
  expect(s.getByTestId('first-week-shop')).toHaveTextContent('Coin shop');
  expect(s.getByTestId('first-week-sizes')).toHaveTextContent('Room sizes');
  fireEvent.press(s.getByTestId('first-week-shop'));
  fireEvent.press(s.getByTestId('first-week-sizes'));
  expect(mockNavigate.mock.calls).toEqual([['CoinShop'], ['RoomSizes']]);
});

it('its two buttons are 44-point Buttons (owner rule)', async () => {
  const s = await card(OPEN);
  for (const id of ['first-week-shop', 'first-week-sizes']) {
    const classes = String(s.getByTestId(id).props.className).split(' ');
    expect([classes.includes('h-[44px]'), classes.includes('h-[36px]')]).toEqual([true, false]);
  }
});

it('follows each new read: a ticked row and the next day show at once, and past day 7 the card is gone', async () => {
  const s = await card(OPEN);
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ ...OPEN, day: 5, done: 5, tasks: OPEN.tasks.map((t) => (t.key === 'recap' ? { ...t, done: true } : t)) });
  await act(async () => { await loadFirstWeek(); });
  expect(s.getByText('Day 5 of 7 · 5 of 7 done')).toBeTruthy();
  expect(s.getByTestId('first-week-recap').props.accessibilityLabel).toBe('Read your first weekly recap, done, plus 10 coins');
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
  await act(async () => { await loadFirstWeek(); });
  expect(s.queryByTestId('first-week')).toBeNull();
});
