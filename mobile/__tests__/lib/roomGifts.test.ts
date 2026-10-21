// Gifts, the pure parts (spec 2026-10-15 §10.3; P4 rulings 11, 14, PF4-F8).
import { footOf } from '../../src/lib/room/iso/geometry';
import { isoOf } from '../../src/lib/room/catalogue';
import { roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { BOX_PT, GIFT_CELL_PT, MAX_BOXES, giftCrop, giftPoint, giftTiles, spareTiles } from '../../src/lib/room/gifts';
import { starterLayout } from '../../src/lib/room/layout';
import { catRoute, wanderRoutes } from '../../src/lib/room/live/catWander';
import { blockedTiles, planTrip, standTileOf, tileKey } from '../../src/lib/room/live/walk';
import { STARTER_COUNTS, cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { fetchGifts, fetchRoomCheers, openGift } from '../../src/api/rooms';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { loadRoomSocial, openGiftNow, resetRoomSocial, useRoomSocial } from '../../src/lib/room/giftsStore';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../src/api/rooms', () => ({ fetchGifts: jest.fn(), fetchRoomCheers: jest.fn(), openGift: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));

const DAY = { hhmm: '12:00', hour: 12 };

it('a spare is a placeable piece owned twice with one not placed (ruling 11)', () => {
  const layout = starterLayout();
  expect(spareTiles(STARTER_COUNTS, layout)).toEqual([]);
  const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'plant.cactus': 2, 'wall.dots': 2 };
  // The fern: 3 owned, 1 placed → 2 spare; the cactus: 2 owned, 0 placed → 1 (you keep one); a wallpaper is no gift.
  expect(spareTiles(counts, layout)).toEqual([{ itemId: 'plant.fern', spare: 2 }, { itemId: 'plant.cactus', spare: 1 }]);
  // Two placed of two owned: none spare.
  const two = { ...layout, pieces: [...layout.pieces, { ...layout.pieces.find((p) => p.id === 'plant')!, id: 'plant2', x: 6, y: 6 }] };
  expect(spareTiles({ ...STARTER_COUNTS, 'plant.fern': 2 }, two)).toEqual([]);
});

it('puts up to 3 boxes on free tiles of the front row, never on a piece, the chair or its exit tile (ruling 14)', () => {
  const layout = starterLayout();
  const tiles = giftTiles(layout, 1, 5);
  expect(tiles.length).toBeLessThanOrEqual(MAX_BOXES);
  expect(tiles.length).toBeGreaterThan(0);
  for (const [i, j] of tiles) {
    expect(j).toBe(6);
    for (const p of layout.pieces.filter((q) => q.layer === 'floor' && !isoOf(q.item)?.flat)) {
      const a = footOf(p, isoOf(p.item)!);
      expect([p.id, i >= a.x0 && i < a.x1 && j >= a.y0 && j < a.y1]).toEqual([p.id, false]);
    }
  }
  expect(giftTiles(layout, 1, 0)).toEqual([]);
  const [x, y] = [giftPoint(1, [0, 6], { x: 0, y: 0 }, 2).x, giftPoint(1, [0, 6], { x: 0, y: 0 }, 2).y];
  expect([Number.isInteger(x), Number.isInteger(y)]).toEqual([true, true]);
});

describe('in view of the room card (PF4-F8: the P3 T11-ROW logic)', () => {
  const inCrop = (tier: 1 | 2 | 3, layout: RoomLayout, tile: [number, number], width: number) => {
    const { offset } = giftCrop(layout, tier, width, 240);
    const { x, y } = giftPoint(tier, tile, offset, GIFT_CELL_PT);
    const left = x - BOX_PT / 2;
    const top = y - BOX_PT + 10;
    return left >= 0 && top >= 0 && left + BOX_PT <= width && top + BOX_PT <= 240;
  };

  it.each([1, 2, 3] as const)('tier %i: every box stands wholly inside the 323 × 240 crop, on the frontmost rows it shows', (tier) => {
    const layout = starterLayout();
    const { view } = giftCrop(layout, tier, 323, 240);
    const tiles = giftTiles(layout, tier, 3, view);
    expect(tiles).toHaveLength(3);
    for (const t of tiles) expect([t, inCrop(tier, layout, t, 323)]).toEqual([t, true]);
    // Never KIP's seat [3, 1] or the tile out of it [3, 2], never a footprint.
    const blocked = blockedTiles(layout);
    for (const t of tiles) expect([t, blocked.has(tileKey(t)) || (t[0] === 3 && t[1] <= 2)]).toEqual([t, false]);
    // The frontmost row with a free tile in view comes first: no free in-view tile in front of the first box's row.
    const front = Math.max(...tiles.map((t) => t[1]));
    expect(tiles[0]![1]).toBe(front);
    // Without the crop at tier 2 and 3, j = m − 1 is cut off the card: the plain front row would be off screen.
    if (tier > 1) expect(giftTiles(layout, tier, 3).some((t) => !inCrop(tier, layout, t, 323))).toBe(true);
  });

  it('with no free tile in view, there is no box', () => {
    expect(giftTiles(starterLayout(), 1, 3, { x: -1000, y: -1000, w: 1, h: 1 })).toEqual([]);
  });

  it('the cat wanders round the boxes, and KIP never walks onto one (PF4-F8)', () => {
    const cat: Placement = { id: 'p1', item: 'pet.tabby', layer: 'floor', x: 5, y: 3, facing: 'L', mirror: false };
    const layout: RoomLayout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat] };
    const { view } = giftCrop(layout, 1, 323, 240);
    const boxes = new Set(giftTiles(layout, 1, 3, view).map(tileKey));
    expect(boxes.size).toBe(3);
    const free = catRoute(layout, 1, cat, undefined, view)!;
    expect(free.some((t) => boxes.has(tileKey(t)))).toBe(true); // without the boxes it would walk over them
    const effects = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, DAY);
    const routes = wanderRoutes(layout, 1, effects, undefined, view, boxes);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.path.some((t) => boxes.has(tileKey(t)))).toBe(false);
    // KIP's only target in the starter room is the fern: with a box on its stand tile, KIP stays seated.
    const fern = layout.pieces.find((p) => p.id === 'plant')!;
    const stand = standTileOf(layout, fern, 1, blockedTiles(layout))!;
    const still = roomEffects(starterLayout(), 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, DAY);
    expect(planTrip(starterLayout(), 1, still, view, null, () => 0)).not.toBeNull();
    expect(planTrip(starterLayout(), 1, still, view, null, () => 0, undefined, new Set([tileKey(stand)]))).toBeNull();
  });
});

describe('the gifts store (spec §10.2, §10.3)', () => {
  const gift = (id: string, itemId = 'plant.ivy') => ({ id, itemId, note: 'cosy' as const, from: { name: 'Maya' }, quiet: false, at: '2026-10-26T10:00:00.000Z' });
  const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    resetRoomSocial();
    resetCosmetics();
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
    (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 3, cheers: [] });
    await loadCosmetics();
  });

  it('reads the gifts and the week\'s cheers; an older server (404) has neither', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [gift('g1')] });
    const { result } = renderHook(() => useRoomSocial());
    await act(async () => { await loadRoomSocial(); });
    expect([result.current.gifts.map((g) => g.id), result.current.cheers]).toEqual([['g1'], 3]);
    (fetchGifts as jest.Mock).mockRejectedValue(new ApiError(404, 'not_found', 'not_found'));
    (fetchRoomCheers as jest.Mock).mockRejectedValue(new ApiError(404, 'not_found', 'not_found'));
    await act(async () => { await loadRoomSocial(); });
    expect(result.current).toEqual({ gifts: [], cheers: 0 });
  });

  it('a read that started before an open never brings the opened gift back', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [gift('g1')] });
    await loadRoomSocial();
    const slow = deferred<{ gifts: ReturnType<typeof gift>[] }>();
    (fetchGifts as jest.Mock).mockReturnValueOnce(slow.promise);
    const read = loadRoomSocial();
    (openGift as jest.Mock).mockResolvedValue({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } });
    const reload = deferred<ReturnType<typeof cosmeticsDTO>>();
    (fetchCosmetics as jest.Mock).mockReturnValueOnce(reload.promise);
    expect(await openGiftNow('g1')).toBe('plant.ivy');
    slow.resolve({ gifts: [gift('g1')] });
    await read;
    const { result } = renderHook(() => useRoomSocial());
    expect(result.current.gifts).toEqual([]);
    // The copy is owned and NEW at once, and the cosmetics are read again (T11T12-RELOAD).
    expect(getCosmetics()?.counts['plant.ivy']).toBe(1);
    expect(getCosmetics()?.fresh).toContainEqual({ itemId: 'plant.ivy', source: 'gift_in' });
    expect(fetchCosmetics).toHaveBeenCalledTimes(2);
    reload.resolve(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 }, fresh: [{ itemId: 'plant.ivy', source: 'gift_in' }], version: 2 }));
    await act(async () => undefined);
    expect(getCosmetics()?.version).toBe(2);
  });

  it('an answer that lands after sign-out touches neither store', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [gift('g1')] });
    await loadRoomSocial();
    const slow = deferred<{ counts: Record<string, number> }>();
    (openGift as jest.Mock).mockReturnValueOnce(slow.promise);
    const opening = openGiftNow('g1');
    resetRoomSocial();
    resetCosmetics();
    slow.resolve({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } });
    expect(await opening).toBeNull();
    const { result } = renderHook(() => useRoomSocial());
    expect(result.current).toEqual({ gifts: [], cheers: 0 });
    expect(getCosmetics()).toBeNull();
  });

  it('a gift already gone (returned) leaves the floor; any other failure keeps it there to tap again', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [gift('g1'), gift('g2')] });
    await loadRoomSocial();
    (openGift as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'try_later', 'try_later'));
    await expect(openGiftNow('g1')).rejects.toBeInstanceOf(ApiError);
    const { result } = renderHook(() => useRoomSocial());
    expect(result.current.gifts.map((g) => g.id)).toEqual(['g1', 'g2']);
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [gift('g2')] });
    (openGift as jest.Mock).mockRejectedValueOnce(new ApiError(404, 'gift_gone', 'gift_gone'));
    await act(async () => { expect(await openGiftNow('g1')).toBeNull(); });
    expect(result.current.gifts.map((g) => g.id)).toEqual(['g2']);
    expect(getCosmetics()?.fresh).toEqual([]);
  });
});
