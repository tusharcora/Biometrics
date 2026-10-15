import { ApiError } from '../../src/api/client';
import { postExpand, postPurchase, type ExpandDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { buyPiece, growRoom, newRequestId } from '../../src/lib/coins/actions';
import { getCoins, resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/coins', () => ({
  fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetCoins();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await loadCosmetics();
  setCoinBalance(200);
});

it('a purchase lands in both stores: the balance, the counts, owned and NEW (spec §6.6, ruling 7)', async () => {
  (postPurchase as jest.Mock).mockResolvedValue({ balance: 50, counts: { ...STARTER_COUNTS, 'item.radio': 1 } });
  await buyPiece('item.radio', 'req-1');
  expect(postPurchase).toHaveBeenCalledWith('req-1', 'item.radio');
  const c = getCosmetics()!;
  expect([getCoins()!.balance, c.counts['item.radio'], c.owned.has('item.radio'), c.fresh]).toEqual([50, 1, true, [{ itemId: 'item.radio', source: 'buy' }]]);
});

it('a room read that started before the purchase cannot wipe the new count', async () => {
  let resolve!: (v: unknown) => void;
  (fetchCosmetics as jest.Mock).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const read = loadCosmetics();
  (postPurchase as jest.Mock).mockResolvedValue({ balance: 50, counts: { ...STARTER_COUNTS, 'item.radio': 1 } });
  await buyPiece('item.radio', 'req-2');
  resolve(cosmeticsDTO());
  await read;
  expect(getCosmetics()!.counts['item.radio']).toBe(1);
});

it('a refused purchase changes nothing and throws the server\'s error', async () => {
  (postPurchase as jest.Mock).mockRejectedValue(new ApiError(409, 'x', 'not_enough_coins', { error: 'not_enough_coins', needed: 40 }));
  await expect(buyPiece('item.radio', 'req-3')).rejects.toMatchObject({ status: 409, code: 'not_enough_coins' });
  expect([getCoins()!.balance, getCosmetics()!.counts['item.radio']]).toEqual([200, undefined]);
});

it('a grow publishes the grown room (newer version) and the balance', async () => {
  const body: ExpandDTO = { ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 0, stored: 1 };
  (postExpand as jest.Mock).mockResolvedValue(body);
  expect(await growRoom(2, 'req-4')).toEqual({ stored: 1, tier: 2 });
  expect(postExpand).toHaveBeenCalledWith('req-4', 2);
  expect([getCosmetics()!.tier, getCosmetics()!.cap, getCosmetics()!.version, getCoins()!.balance]).toEqual([2, 60, 3, 0]);
});

it('makes a new request id each time (ruling 30)', () => {
  expect(newRequestId()).not.toBe(newRequestId());
});
