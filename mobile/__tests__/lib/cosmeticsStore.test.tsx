import { act, renderHook } from '@testing-library/react-native';
import { fetchCosmetics, postCosmeticsSeen, postRoomWelcomed, putCosmetics } from '../../src/api/cosmetics';
import { ApiError } from '../../src/api/client';
import { getMyKip, resetMyKip } from '../../src/lib/kip/myKip';
import {
  getCosmetics, hasUnseen, loadCosmetics, markCosmeticsSeen, markWelcomed, resetCosmetics, saveCosmeticsLoadout, useCosmetics, useMyRoom,
} from '../../src/lib/room/cosmeticsStore';
import { NEUTRAL_LIVING } from '../../src/lib/room/effects';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const get = fetchCosmetics as jest.Mock;
const put = putCosmetics as jest.Mock;
const seen = postCosmeticsSeen as jest.Mock;
const welcomed = postRoomWelcomed as jest.Mock;

const RED = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'rug' ? { ...p, item: 'rug.red' } : p)) };
const BEANIE = { ...EMPTY_WORN, head: 'out.beanie' };
const DTO = cosmeticsDTO({
  owned: ['wall.plain', 'rug.red'], fresh: [{ itemId: 'rug.red', source: 'family:SLEEP_GOAL:1' }], layout: RED,
  counts: { ...STARTER_COUNTS, 'rug.red': 1 }, worn: BEANIE, version: 3,
  counters: { recapsRead: 2, buddyCheers: 1 },
});
/** The DTO with another wallpaper at a version (the read-vs-save tests, ruling T10). */
const saved = (wallpaper: string, version: number) => ({ ...DTO, layout: { ...RED, styles: { ...RED.styles, wallpaper } }, version });

beforeEach(() => {
  get.mockReset(); put.mockReset(); seen.mockReset(); welcomed.mockReset();
  resetCosmetics(); resetMyKip();
});

it('loads once, publishes the room, and hands the worn half to useMyKip', async () => {
  get.mockResolvedValue(DTO);
  const { result } = renderHook(() => useMyRoom());
  expect(result.current).toEqual({ layout: starterLayout(), tier: 1, living: NEUTRAL_LIVING });
  await act(async () => { await loadCosmetics(); });
  expect(result.current.layout).toEqual(RED);
  expect(getCosmetics()!.owned.has('rug.red')).toBe(true);
  expect(getMyKip().worn.head).toBe('out.beanie');
  expect(hasUnseen(getCosmetics()!)).toBe(true);
});

it('keeps what it has when a read fails, and a read that lands after sign-out is dropped', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  get.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await loadCosmetics(); });
  expect(getCosmetics()!.version).toBe(3);
  let resolve!: (v: unknown) => void;
  get.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const pending = loadCosmetics();
  act(() => resetCosmetics());
  await act(async () => { resolve(DTO); await pending; });
  expect(getCosmetics()).toBeNull();
});

it('a save publishes the server\'s answer; a failed save throws and changes nothing', async () => {
  get.mockResolvedValue(DTO);
  await act(async () => { await loadCosmetics(); });
  const DOTS = { ...RED, styles: { ...RED.styles, wallpaper: 'wall.dots' } };
  put.mockResolvedValueOnce({ ...DTO, layout: DOTS, version: 4 });
  await act(async () => { await saveCosmeticsLoadout({ layout: DOTS, worn: BEANIE, version: 3 }); });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  put.mockRejectedValueOnce(new ApiError(409, 'stale', 'stale'));
  await expect(saveCosmeticsLoadout({ layout: RED, worn: EMPTY_WORN, version: 3 })).rejects.toBeInstanceOf(ApiError);
  expect(getCosmetics()!.version).toBe(4);
});

it('hands worn items to useMyKip only when they change (Spec B Task 8 minor)', async () => {
  const myKip = require('../../src/lib/kip/myKip');
  const spy = jest.spyOn(myKip, 'setMyKipWorn');
  get.mockResolvedValue(DTO);
  await act(async () => { await loadCosmetics(); });
  await act(async () => { await loadCosmetics(); });
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

it('reads a body without a layout (an older server) as the starter layout, welcomed', async () => {
  const { layout: _drop, welcomed: _w, ...old } = DTO;
  get.mockResolvedValue(old);
  await act(async () => { await loadCosmetics(); });
  expect([getCosmetics()!.layout, getCosmetics()!.welcomed]).toEqual([starterLayout(), true]);
});

it('reads a body without counters as zero recaps read and zero cheers', async () => {
  const { counters: _c, ...old } = DTO;
  get.mockResolvedValue(old);
  await act(async () => { await loadCosmetics(); });
  expect(getCosmetics()!.counters).toEqual({ recapsRead: 0, buddyCheers: 0 });
});

it('a body that is no cosmetics body fails the read and keeps what is shown', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const shown = getCosmetics();
  get.mockResolvedValueOnce({ status: 'CONNECTED', lastSyncedAt: null });
  await act(async () => { await loadCosmetics(); });
  expect(getCosmetics()).toBe(shown);
});

it('marking seen clears fresh at once and tells the server; a failed post is ignored', async () => {
  get.mockResolvedValue(DTO);
  await act(async () => { await loadCosmetics(); });
  seen.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await markCosmeticsSeen(['rug.red']); });
  expect(seen).toHaveBeenCalledWith(['rug.red']);
  expect(hasUnseen(getCosmetics()!)).toBe(false);
});

function deferredGet() {
  let resolve!: (v: unknown) => void;
  get.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  return (v: unknown) => resolve(v);
}

it('a read that started before a save never reverts it; a read started after the save still lands', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const finish = deferredGet();
  const pending = loadCosmetics();
  put.mockResolvedValueOnce(saved('wall.dots', 4));
  await act(async () => { await saveCosmeticsLoadout({ layout: saved('wall.dots', 3).layout, worn: BEANIE, version: 3 }); });
  await act(async () => { finish(DTO); await pending; });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  get.mockResolvedValueOnce(saved('wall.brick', 5));
  await act(async () => { await loadCosmetics(); });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.brick', 5]);
});

it('a read older than what is shown is ignored', async () => {
  get.mockResolvedValueOnce({ ...DTO, version: 4 });
  await act(async () => { await loadCosmetics(); });
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  expect(getCosmetics()!.version).toBe(4);
});

it('a read that started before marking seen never brings the seen ids back', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const finish = deferredGet();
  const pending = loadCosmetics();
  seen.mockResolvedValueOnce(undefined);
  await act(async () => { await markCosmeticsSeen(['rug.red']); });
  await act(async () => { finish(DTO); await pending; });
  expect(hasUnseen(getCosmetics()!)).toBe(false);
  get.mockResolvedValueOnce({ ...DTO, fresh: [{ itemId: 'wall.dots', source: 'counter:recaps_read:2' }] });
  await act(async () => { await loadCosmetics(); });
  expect(getCosmetics()!.fresh.map((f) => f.itemId)).toEqual(['wall.dots']);
});

function deferredPut() {
  let resolve!: (v: unknown) => void;
  put.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  return (v: unknown) => resolve(v);
}

it('marking seen while a save is in flight never drops the save\'s answer', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const finish = deferredPut();
  const pending = saveCosmeticsLoadout({ layout: saved('wall.dots', 3).layout, worn: BEANIE, version: 3 });
  seen.mockResolvedValueOnce(undefined);
  await act(async () => { await markCosmeticsSeen(['rug.red']); });
  await act(async () => { finish(saved('wall.dots', 4)); await pending; });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
});

it('two overlapping saves both publish in order and end at the higher version, whichever answers last', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  let first = deferredPut();
  let second = deferredPut();
  let a = saveCosmeticsLoadout({ layout: saved('wall.dots', 3).layout, worn: BEANIE, version: 3 });
  let b = saveCosmeticsLoadout({ layout: saved('wall.brick', 4).layout, worn: BEANIE, version: 4 });
  await act(async () => { first(saved('wall.dots', 4)); await a; });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  await act(async () => { second(saved('wall.brick', 5)); await b; });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.brick', 5]);
  // Answers out of order: the older one never replaces the newer.
  first = deferredPut();
  second = deferredPut();
  a = saveCosmeticsLoadout({ layout: saved('wall.panel', 5).layout, worn: BEANIE, version: 5 });
  b = saveCosmeticsLoadout({ layout: saved('wall.subway', 6).layout, worn: BEANIE, version: 6 });
  await act(async () => { second(saved('wall.subway', 7)); await b; });
  await act(async () => { first(saved('wall.panel', 6)); await a; });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.subway', 7]);
});

it('a save that answers after sign-out is dropped', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const finish = deferredPut();
  const pending = saveCosmeticsLoadout({ layout: saved('wall.dots', 3).layout, worn: BEANIE, version: 3 });
  act(() => resetCosmetics());
  await act(async () => { finish(saved('wall.dots', 4)); await pending; });
  expect(getCosmetics()).toBeNull();
});

it('useCosmetics is null until the first read', () => {
  const { result } = renderHook(() => useCosmetics());
  expect(result.current).toBeNull();
});

it('two loads at once share one read (sign-in: MyKipScope and the room toast)', async () => {
  const finish = deferredGet();
  const a = loadCosmetics();
  const b = loadCosmetics();
  expect(get).toHaveBeenCalledTimes(1);
  await act(async () => { finish(DTO); await Promise.all([a, b]); });
  expect(await a).toBe(getCosmetics());
  expect(await b).toBe(getCosmetics());
  // Once it has landed, the next load reads again.
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  expect(get).toHaveBeenCalledTimes(2);
});

it('a load after a mutation starts a new read, and the shared read from before never lands', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const stale = deferredGet();
  const before = loadCosmetics();
  seen.mockResolvedValueOnce(undefined);
  await act(async () => { await markCosmeticsSeen(['rug.red']); });
  const fresh = deferredGet();
  const after = loadCosmetics();
  expect(get).toHaveBeenCalledTimes(3);
  await act(async () => { stale(DTO); await before; });
  expect(hasUnseen(getCosmetics()!)).toBe(false);
  await act(async () => { fresh({ ...DTO, version: 4, fresh: [{ itemId: 'wall.dots', source: 'counter:recaps_read:2' }] }); await after; });
  expect(getCosmetics()!.fresh.map((f) => f.itemId)).toEqual(['wall.dots']);
});

it('a fresh load never shares an older read: it moves the epoch, so the older answer is dropped (ruling T14-CARRY)', async () => {
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  const stale = deferredGet();
  const before = loadCosmetics();
  const fresh = deferredGet();
  const after = loadCosmetics({ fresh: true });
  expect(get).toHaveBeenCalledTimes(3);
  // The fresh read answers first; the older one, answered later with what it saw then, never lands over it.
  await act(async () => { fresh({ ...DTO, tier: 2, cap: 60, version: 5 }); await after; });
  expect(await after).toBe(getCosmetics());
  expect(getCosmetics()!.tier).toBe(2);
  await act(async () => { stale({ ...DTO, version: 6 }); await before; });
  expect([getCosmetics()!.tier, getCosmetics()!.version]).toEqual([2, 5]);
  // A plain load in the same epoch shares the fresh one's read while it is in flight.
  const again = deferredGet();
  const c = loadCosmetics({ fresh: true });
  const d = loadCosmetics();
  expect(get).toHaveBeenCalledTimes(4);
  await act(async () => { again(DTO); await Promise.all([c, d]); });
});

it('a load after sign-out starts a new read', async () => {
  deferredGet();
  void loadCosmetics();
  act(() => resetCosmetics());
  get.mockResolvedValueOnce(DTO);
  await act(async () => { await loadCosmetics(); });
  expect(get).toHaveBeenCalledTimes(2);
  expect(getCosmetics()!.version).toBe(3);
});

it('markWelcomed hides the welcome at once and tells the server; an older read cannot bring it back', async () => {
  get.mockResolvedValueOnce({ ...DTO, welcomed: false });
  await act(async () => { await loadCosmetics(); });
  const late = deferredGet();
  const pending = loadCosmetics();
  welcomed.mockResolvedValueOnce(undefined);
  await act(async () => { await markWelcomed(); });
  expect(getCosmetics()!.welcomed).toBe(true);
  expect(postRoomWelcomed).toHaveBeenCalled();
  await act(async () => { late({ ...DTO, welcomed: false }); await pending; });
  expect(getCosmetics()!.welcomed).toBe(true);
});

it('markWelcomed ignores a failed post: the next read shows the welcome again, which is harmless', async () => {
  get.mockResolvedValueOnce({ ...DTO, welcomed: false });
  await act(async () => { await loadCosmetics(); });
  welcomed.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await markWelcomed(); });
  expect(getCosmetics()!.welcomed).toBe(true);
});

it('keeps the living room from the body, and reads a missing or broken one as neutral (spec §8.3)', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ living: { plantStage: 2, petEnergy: 'nap', awards: [4] } }));
  expect((await loadCosmetics({ fresh: true }))!.living).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [4] });
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ version: 2, living: 'nope' }));
  expect((await loadCosmetics({ fresh: true }))!.living).toEqual(NEUTRAL_LIVING);
});

it('reads a body with no living at all (an older server, PF3-LIVING) as the neutral room: plants fully grown', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ living: undefined }));
  const c = (await loadCosmetics({ fresh: true }))!;
  expect([c.living, c.living.plantStage]).toEqual([NEUTRAL_LIVING, 5]);
});
