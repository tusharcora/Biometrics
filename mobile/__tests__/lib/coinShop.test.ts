import type { ShopDTO } from '../../src/api/coins';
import { SHOP_TABS, pieceSheet, shopTiles, whereLine } from '../../src/lib/coins/shop';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const SHOP: ShopDTO = {
  week: '2026-W44',
  set: { id: 'deskDay', itemIds: ['item.mug', 'item.radio'] },
  items: [
    { itemId: 'plant.monstera', price: 140, locked: true }, { itemId: 'art.neonheart', price: 200, locked: false }, { itemId: 'item.radio', price: 150, locked: false },
    { itemId: 'item.mug', price: 25, locked: false }, { itemId: 'rug.slate', price: 80, locked: false },
  ],
};
/** An offer as the server sends it: `locked` is its word, never the app's guess (PF4-F1). */
const offer = (itemId: string, price: number, locked = false) => ({ itemId, price, locked });

it('lists the week\'s set first, prices shop pieces, and locks a rule piece not earned yet with its rule (spec §6.5, §6.6)', () => {
  const tiles = shopTiles(SHOP, STARTER_COUNTS, 'all');
  expect(tiles.map((t) => t.itemId)).toEqual(['item.radio', 'item.mug', 'plant.monstera', 'art.neonheart', 'rug.slate']);
  const monstera = tiles.find((t) => t.itemId === 'plant.monstera')!;
  expect([monstera.locked, monstera.lockLine, monstera.label]).toEqual([true, 'Sleep goal · I', 'Monstera, locked. Sleep goal, level 1']);
  expect(tiles.find((t) => t.itemId === 'item.mug')!.label).toBe('Mug, 25 coins, 1 owned');
  const earned = { ...SHOP, items: SHOP.items.map((i) => ({ ...i, locked: false })) };
  expect(shopTiles(earned, STARTER_COUNTS, 'all').find((t) => t.itemId === 'plant.monstera')!.locked).toBe(false);
});

it('a gifted rule piece not earned yet stays locked with no buy: the server\'s `locked`, not the count, decides (PF4-F1, P4 ruling 15)', () => {
  const gifted = { ...STARTER_COUNTS, 'plant.monstera': 1 };
  const monstera = shopTiles(SHOP, gifted, 'all').find((t) => t.itemId === 'plant.monstera')!;
  expect([monstera.locked, monstera.owned, monstera.lockLine]).toEqual([true, 1, 'Sleep goal · I']);
  expect(pieceSheet(offer('plant.monstera', 140, true), 999)).toEqual(expect.objectContaining({ locked: 'Sleep goal · I', canBuy: false }));
});

it('filters by where a piece goes, and to the week\'s set (ruling 13)', () => {
  expect(shopTiles(SHOP, STARTER_COUNTS, 'wall').map((t) => t.itemId)).toEqual(['art.neonheart']);
  expect(shopTiles(SHOP, STARTER_COUNTS, 'onTop').map((t) => t.itemId)).toEqual(['item.radio', 'item.mug', 'plant.monstera']);
  expect(shopTiles(SHOP, STARTER_COUNTS, 'all', true).map((t) => t.itemId)).toEqual(['item.radio', 'item.mug']);
});

it('says where it goes, what you have and have after, or what is still needed (C1)', () => {
  expect(whereLine('item.radio')).toEqual({ text: 'Shelf, desk or floor · 1 tile', spoken: 'Shelf, desk or floor, 1 tile' });
  expect(whereLine('rug.slate')).toEqual({ text: 'Floor · 4 × 4 tiles', spoken: 'Floor, 4 by 4 tiles' });
  expect(whereLine('art.neonheart')).toEqual({ text: 'Wall', spoken: 'Wall' });
  expect(pieceSheet(offer('item.radio', 150), 360)).toEqual({
    name: 'Old radio', where: whereLine('item.radio'), locked: null, lockedSpoken: null,
    have: 'You have 360 · 210 after', haveSpoken: 'You have 360, 210 after', canBuy: true, button: 'Get for 150',
    effect: 'Plays a quiet lo-fi loop while the room is open. Notes float up from it.',
  });
  const short = pieceSheet(offer('item.radio', 150), 110);
  expect([short.canBuy, short.button, short.have]).toEqual([false, 'Needs 40 more', 'You have 110']);
  expect(pieceSheet(offer('plant.monstera', 140, true), 999)).toEqual(expect.objectContaining({ locked: 'Sleep goal · I', canBuy: false }));
});

it('reads a locked piece\'s rule aloud with no "·" and no Roman numeral (ruling PF-F6)', () => {
  const sheet = pieceSheet(offer('plant.monstera', 140, true), 999);
  expect(sheet.lockedSpoken).toBe('Sleep goal, level 1');
  expect([ROOM_COPY.shop.locked(sheet.locked!), ROOM_COPY.shop.lockedSpoken(sheet.lockedSpoken!)]).toEqual([
    'Earn it first: Sleep goal · I', 'Earn it first: Sleep goal, level 1',
  ]);
  const spoken = [
    ROOM_COPY.shop.lockedSpoken(sheet.lockedSpoken!), pieceSheet(offer('item.radio', 150), 360).haveSpoken,
    ...shopTiles(SHOP, STARTER_COUNTS, 'all').map((t) => t.label), ...SHOP.items.map((i) => whereLine(i.itemId).spoken),
  ];
  for (const s of spoken) expect(s).not.toMatch(/·|−|\b(I|II|III|IV|V)\b/);
});

it('never prices the shop in money: no currency, no real-money or ad copy (spec §6.1, ruling 11)', () => {
  const S = ROOM_COPY.shop;
  // JSON.stringify drops the functions, so every composed string is checked with sample arguments too.
  const composed = [
    S.setLine('Desk day', 2), S.setSpoken('Desk day', 2), S.tile('Mug', '25', 1), S.tileLocked('Monstera', 'Sleep goal, level 1'), S.owned(2),
    S.tileEffect('Old radio, 150 coins'), S.have('360', '210'), S.haveSpoken('360', '210'), S.haveOnly('110'), S.get('150'), S.needs('40'), S.bought('Mug'),
    S.locked('Sleep goal · I'), S.lockedSpoken('Sleep goal, level 1'), S.where.tiles(4, 4), S.where.tilesSpoken(4, 4),
  ];
  for (const s of [JSON.stringify(S), ...composed]) {
    expect(s).not.toMatch(/[$£€¥]|\b(USD|EUR|GBP)\b|get more coins|buy coins|coin pack|in-app purchase|watch an ad|\bads?\b/i);
  }
});

it('the Effects tab lists the pieces that do something, and says so on the tile and the sheet (spec §6.6, ruling 19)', () => {
  const shop: ShopDTO = { ...SHOP, items: [...SHOP.items, offer('corner.floorlamp', 120), offer('pet.tabby', 180)] };
  const counts = { ...STARTER_COUNTS, 'corner.floorlamp': 1 };
  expect(shopTiles(shop, counts, 'effects').map((t) => t.itemId)).toEqual(['item.radio', 'corner.floorlamp', 'pet.tabby']);
  const radio = shopTiles(shop, counts, 'all').find((t) => t.itemId === 'item.radio')!;
  expect([radio.effect, radio.label]).toEqual(['sound', 'Old radio, 150 coins, does something in the room']);
  expect(radio.label).toBe(ROOM_COPY.shop.tileEffect(ROOM_COPY.shop.tile('Old radio', '150', 0))); // the joiner is copy (T9-CARRY)
  expect(shopTiles(shop, counts, 'all').find((t) => t.itemId === 'item.mug')!.effect).toBeNull();
  expect(pieceSheet(offer('item.radio', 150), 360).effect).toBe('Plays a quiet lo-fi loop while the room is open. Notes float up from it.');
  expect(pieceSheet(offer('item.mug', 25), 360).effect).toBeNull();
  expect(SHOP_TABS).toEqual(['all', 'effects', 'floor', 'wall', 'onTop']);
});
