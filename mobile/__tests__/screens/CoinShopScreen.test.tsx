import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { fetchCoins, fetchFirstWeek, fetchShop, postPurchase, type ShopDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetCoins } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { CoinShopScreen } from '../../src/screens/CoinShopScreen';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined), postRoomWelcomed: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));

const SHOP: ShopDTO = {
  week: '2026-W44', set: { id: 'deskDay', itemIds: ['item.radio', 'item.mug'] },
  items: [{ itemId: 'item.radio', price: 150 }, { itemId: 'item.mug', price: 25 }, { itemId: 'plant.monstera', price: 140 }, { itemId: 'art.neonheart', price: 200 }],
};
const wallet = (balance: number) => ({ balance, today: { earned: 0, cap: 60 }, events: [], next: null });

async function open(balance = 360) {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockResolvedValue(wallet(balance));
  (fetchShop as jest.Mock).mockResolvedValue(SHOP);
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
  await act(async () => { await loadCosmetics(); });
  const s = render(<CoinShopScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); resetCosmetics(); });

it('shows the week\'s set card, tiles with prices, a locked rule piece with its rule, the wallet and the footer (spec §6.6)', async () => {
  const s = await open();
  expect(s.getByText('Desk day set · 2 pieces · this week').props.accessibilityLabel).toBe('Desk day set, 2 pieces, this week');
  expect(s.getByTestId('shop-tile-item.radio').props.accessibilityLabel).toBe('Old radio, 150 coins');
  expect(s.getByTestId('shop-tile-plant.monstera').props.accessibilityLabel).toBe('Monstera, locked. Sleep goal, level 1');
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
  expect(s.getByText('Coins come from healthy days only. They can’t be bought.')).toBeTruthy();
  fireEvent.press(s.getByTestId('shop-tab-wall'));
  expect(s.queryByTestId('shop-tile-item.radio')).toBeNull();
  expect(s.getByTestId('shop-tile-art.neonheart')).toBeTruthy();
});

it('shows only the week\'s set, then everything again', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-week-toggle'));
  expect([s.queryByTestId('shop-tile-plant.monstera'), !!s.getByTestId('shop-tile-item.mug')]).toEqual([null, true]);
  fireEvent.press(s.getByTestId('shop-week-toggle'));
  expect(s.getByTestId('shop-tile-plant.monstera')).toBeTruthy();
});

it('buys only when the server answers: one request for two taps, then NEW in the inventory and the new balance (Review Focus 3)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 360 · 210 after');
  expect(s.getByTestId('shop-sheet-have').props.accessibilityLabel).toBe('You have 360, 210 after');
  let resolve!: (v: unknown) => void;
  (postPurchase as jest.Mock).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  fireEvent.press(s.getByTestId('shop-get'));
  fireEvent.press(s.getByTestId('shop-get'));
  expect(postPurchase).toHaveBeenCalledTimes(1);
  expect(s.getByTestId('shop-get').props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
  expect(getCosmetics()!.counts['item.radio']).toBeUndefined(); // never optimistic
  // The server's room after the purchase (ruling T11T12-RELOAD reads it again at once).
  const bought = { ...STARTER_COUNTS, 'item.radio': 1 };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: bought, owned: Object.keys(bought).sort(), fresh: [{ itemId: 'item.radio', source: 'buy' }] }));
  const [cosmeticsReads, weekReads] = [(fetchCosmetics as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length];
  await act(async () => { resolve({ balance: 210, counts: bought }); });
  expect(s.queryByTestId('shop-sheet')).toBeNull();
  expect(s.getByTestId('shop-notice')).toHaveTextContent('Old radio is in your inventory.');
  expect([getCosmetics()!.counts['item.radio'], getCosmetics()!.fresh]).toEqual([1, [{ itemId: 'item.radio', source: 'buy' }]]);
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('210 KIP coins. Open coin history');
  expect([(fetchCosmetics as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length]).toEqual([cosmeticsReads + 1, weekReads + 1]);
});

it('with too few coins the button is disabled and says what is still needed', async () => {
  const s = await open(110);
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  expect(s.getByTestId('shop-get')).toHaveTextContent('Needs 40 more');
  expect(s.getByTestId('shop-get').props.accessibilityState.disabled).toBe(true);
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 110');
});

it('a dropped connection keeps the request id, so the retry is the same purchase; a server answer drops it (ruling 30)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  (postPurchase as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("Couldn't get it just now. Try again.");
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'not_enough_coins', { error: 'not_enough_coins', needed: 40 }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  const [first, second] = (postPurchase as jest.Mock).mock.calls.map((c) => c[0]);
  expect(second).toBe(first);
  expect(s.getByTestId('shop-notice')).toHaveTextContent('Not enough coins for that yet.');
  expect((fetchCoins as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2); // the wallet is read again
  (postPurchase as jest.Mock).mockResolvedValueOnce({ balance: 335, counts: { ...STARTER_COUNTS, 'item.mug': 2 } });
  fireEvent.press(s.getByTestId('shop-not-now'));
  fireEvent.press(s.getByTestId('shop-tile-item.mug'));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect((postPurchase as jest.Mock).mock.calls[2]![0]).not.toBe(first);
});

it('only not_for_sale says the piece is not in the shop; a 500 and any other answer get the retry line (ruling T11-ERR)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(500, 'x', 'internal', { error: 'internal' }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("Couldn't get it just now. Try again.");
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(400, 'x', 'invalid_body', { error: 'invalid_body' }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("Couldn't get it just now. Try again.");
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(400, 'x', 'not_for_sale', { error: 'not_for_sale' }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("That piece isn't in the shop just now.");
  // Each was a server answer: every attempt got a new request id.
  expect(new Set((postPurchase as jest.Mock).mock.calls.map((c) => c[0])).size).toBe(3);
});

it('a locked piece\'s sheet shows how it is earned, read with no "·" or Roman numeral, and no Get button; Close goes back', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-plant.monstera'));
  expect(s.getByTestId('shop-sheet-locked')).toHaveTextContent('Earn it first: Sleep goal · I');
  expect(s.getByTestId('shop-sheet-locked').props.accessibilityLabel).toBe('Earn it first: Sleep goal, level 1');
  expect(s.queryByTestId('shop-get')).toBeNull();
  // The sheet is modal to a screen reader: Not now closes it, then the header's Close is reachable again.
  expect(s.queryByTestId('shop-close')).toBeNull();
  fireEvent.press(s.getByTestId('shop-not-now'));
  fireEvent.press(s.getByTestId('shop-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('a shop that fails to load offers Try again', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockResolvedValue(wallet(360));
  (fetchShop as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(SHOP);
  await act(async () => { await loadCosmetics(); });
  const s = render(<CoinShopScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('shop-failed')).toHaveTextContent(/^Couldn't open the shop just now\. Check your connection and try again\./);
  await act(async () => { fireEvent.press(s.getByTestId('shop-retry')); });
  expect(s.getByTestId('shop-tile-item.radio')).toBeTruthy();
});
