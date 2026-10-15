import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { AccessibilityInfo, Platform } from 'react-native';
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
  expect(s.getByTestId('shop-not-now').props.accessibilityState.disabled).toBe(true);
  expect(getCosmetics()!.counts['item.radio']).toBeUndefined(); // never optimistic
  // The reload after the purchase (ruling T11T12-RELOAD) is held, so what follows is the purchase's answer alone.
  let reloaded!: (v: unknown) => void;
  (fetchCosmetics as jest.Mock).mockReturnValueOnce(new Promise((r) => { reloaded = r; }));
  const [cosmeticsReads, weekReads] = [(fetchCosmetics as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length];
  const bought = { ...STARTER_COUNTS, 'item.radio': 1 };
  await act(async () => { resolve({ balance: 210, counts: bought }); });
  expect(s.queryByTestId('shop-sheet')).toBeNull();
  expect(s.getByTestId('shop-notice')).toHaveTextContent('Old radio is in your inventory.');
  expect([getCosmetics()!.counts['item.radio'], getCosmetics()!.fresh]).toEqual([1, [{ itemId: 'item.radio', source: 'buy' }]]);
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('210 KIP coins. Open coin history');
  expect([(fetchCosmetics as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length]).toEqual([cosmeticsReads + 1, weekReads + 1]);
  // The server's room lands after it, and the piece stays.
  await act(async () => { reloaded(cosmeticsDTO({ counts: bought, owned: Object.keys(bought).sort(), fresh: [{ itemId: 'item.radio', source: 'buy' }] })); });
  expect(getCosmetics()!.counts['item.radio']).toBe(1);
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

describe('the sheet and a screen reader (ruling T11-FIX)', () => {
  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;
  let handle: jest.SpyInstance;
  beforeEach(() => {
    // The test renderer has no native views: each ref stands for itself, so the test sees which element got focus.
    handle = jest.spyOn(require('react-native') as typeof ReactNative, 'findNodeHandle').mockImplementation(((el: unknown) => el) as never);
    focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  afterEach(() => { handle.mockRestore(); focus.mockRestore(); announce.mockRestore(); });
  const focused = () => focus.mock.calls.map(([el]) => (el as { props?: { testID?: string } }).props?.testID);

  it('takes focus to the piece\'s name when it opens and back to its tile on Not now; Android hides what is behind it', async () => {
    const s = await open();
    expect(s.getByTestId('shop-behind').props.importantForAccessibility).toBeUndefined();
    fireEvent.press(s.getByTestId('shop-tile-item.radio'));
    expect(focused()).toEqual(['shop-sheet-name']);
    const behind = s.getByTestId('shop-behind', { includeHiddenElements: true });
    expect([behind.props.importantForAccessibility, behind.props.accessibilityElementsHidden]).toEqual(['no-hide-descendants', true]);
    expect(s.getByTestId('shop-sheet').props.accessibilityViewIsModal).toBe(true);
    fireEvent.press(s.getByTestId('shop-not-now'));
    expect(focused()).toEqual(['shop-sheet-name', 'shop-tile-item.radio']);
    expect(s.getByTestId('shop-behind').props.importantForAccessibility).toBeUndefined();
  });

  it('after a purchase focus goes to the notice', async () => {
    const s = await open();
    fireEvent.press(s.getByTestId('shop-tile-item.radio'));
    (postPurchase as jest.Mock).mockResolvedValueOnce({ balance: 210, counts: { ...STARTER_COUNTS, 'item.radio': 1 } });
    focus.mockClear();
    await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
    expect(focused()).toEqual(['shop-notice']);
    expect(s.getByTestId('shop-notice')).toBeTruthy();
  });

  it.each([['ios', 1], ['android', 0]] as const)('on %s the notice is announced %i times (Android has the live region)', async (os, times) => {
    const platform = Platform.OS;
    Platform.OS = os;
    try {
      const s = await open();
      fireEvent.press(s.getByTestId('shop-tile-item.radio'));
      (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(400, 'x', 'not_for_sale', { error: 'not_for_sale' }));
      await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
      expect(s.getByTestId('shop-notice').props.accessibilityLiveRegion).toBe('polite');
      expect(announce).toHaveBeenCalledTimes(times);
    } finally {
      Platform.OS = platform;
    }
  });
});

it('the tiles are disabled while a purchase waits on the server', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  let resolve!: (v: unknown) => void;
  (postPurchase as jest.Mock).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  fireEvent.press(s.getByTestId('shop-get'));
  expect(s.getByTestId('shop-tile-item.mug', { includeHiddenElements: true }).props.accessibilityState.disabled).toBe(true);
  await act(async () => { resolve({ balance: 210, counts: { ...STARTER_COUNTS, 'item.radio': 1 } }); });
  expect(s.getByTestId('shop-tile-item.mug').props.accessibilityState.disabled).toBe(false);
});

it('after no answer at all the wallet and the room are read again, so a purchase that landed shows as owned', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  const bought = { ...STARTER_COUNTS, 'item.radio': 1 };
  (fetchCoins as jest.Mock).mockResolvedValue(wallet(210));
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: bought, owned: Object.keys(bought).sort(), fresh: [{ itemId: 'item.radio', source: 'buy' }] }));
  (postPurchase as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("Couldn't get it just now. Try again.");
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 210 · 60 after');
  fireEvent.press(s.getByTestId('shop-not-now'));
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('210 KIP coins. Open coin history');
  expect(s.getByTestId('shop-tile-item.radio').props.accessibilityLabel).toBe('Old radio, 150 coins, 1 owned');
});

it('the sheet waits for the wallet instead of guessing a balance', async () => {
  let landed!: (v: unknown) => void;
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockReturnValueOnce(new Promise((r) => { landed = r; }));
  (fetchShop as jest.Mock).mockResolvedValue(SHOP);
  await act(async () => { await loadCosmetics(); });
  const s = render(<CoinShopScreen />);
  await act(async () => undefined);
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  expect([!!s.getByTestId('shop-sheet-loading'), s.queryByTestId('shop-sheet-have')]).toEqual([true, null]);
  expect(s.getByTestId('shop-get')).toHaveTextContent('Get for 150');
  expect(s.getByTestId('shop-get').props.accessibilityState.disabled).toBe(true);
  await act(async () => { landed(wallet(360)); });
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 360 · 210 after');
  expect(s.getByTestId('shop-get').props.accessibilityState.disabled).toBe(false);
});

it('a 409 whose wallet re-read fails still says what is missing, from the answer\'s own count', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  (fetchCoins as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'not_enough_coins', { error: 'not_enough_coins', needed: 40 }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-get')).toHaveTextContent('Needs 40 more');
  expect(s.getByTestId('shop-get').props.accessibilityState.disabled).toBe(true);
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 110');
});

it('pads the list by the sheet\'s measured height, and names a set it doesn\'t know neutrally', async () => {
  (fetchShop as jest.Mock).mockResolvedValue({ ...SHOP, set: { id: 'someNewSet', itemIds: ['item.radio'] } });
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockResolvedValue(wallet(360));
  await act(async () => { await loadCosmetics(); });
  const s = render(<CoinShopScreen />);
  await act(async () => undefined);
  expect(s.getByText('Featured set · 1 pieces · this week')).toBeTruthy();
  expect(s.queryByText(/someNewSet/)).toBeNull();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  fireEvent(s.getByTestId('shop-sheet'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 300 } } });
  expect(s.getByTestId('shop-scroll', { includeHiddenElements: true }).props.contentContainerStyle).toEqual({ paddingBottom: 316 });
});
