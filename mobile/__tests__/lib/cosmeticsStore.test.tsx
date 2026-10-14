import { act, renderHook } from '@testing-library/react-native';
import { fetchCosmetics, postCosmeticsSeen, putCosmetics } from '../../src/api/cosmetics';
import { ApiError } from '../../src/api/client';
import { getMyKip, resetMyKip } from '../../src/lib/kip/myKip';
import {
  getCosmetics, hasUnseen, loadCosmetics, markCosmeticsSeen, resetCosmetics, saveCosmeticsLoadout, useCosmetics, useMyRoom,
} from '../../src/lib/room/cosmeticsStore';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';

jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn() }));
const get = fetchCosmetics as jest.Mock;
const put = putCosmetics as jest.Mock;
const seen = postCosmeticsSeen as jest.Mock;

const DTO = {
  catalogueVersion: 1, owned: ['wall.plain', 'rug.red'], fresh: [{ itemId: 'rug.red', source: 'family:SLEEP_GOAL:1' }],
  room: { ...STARTER_LOADOUT, rug: 'rug.red' }, worn: { ...EMPTY_WORN, head: 'out.beanie' }, version: 3, counters: { recapsRead: 2, buddyCheers: 1 },
};

beforeEach(() => {
  get.mockReset(); put.mockReset(); seen.mockReset();
  resetCosmetics(); resetMyKip();
});

it('loads once, publishes the room, and hands the worn half to useMyKip', async () => {
  get.mockResolvedValue(DTO);
  const { result } = renderHook(() => useMyRoom());
  expect(result.current).toEqual(STARTER_LOADOUT);
  await act(async () => { await loadCosmetics(); });
  expect(result.current.rug).toBe('rug.red');
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
  put.mockResolvedValueOnce({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.dots' }, version: 4 });
  await act(async () => { await saveCosmeticsLoadout({ room: { ...DTO.room, wallpaper: 'wall.dots' }, worn: DTO.worn, version: 3 }); });
  expect([getCosmetics()!.room.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  put.mockRejectedValueOnce(new ApiError(409, 'stale', 'stale'));
  await expect(saveCosmeticsLoadout({ room: DTO.room, worn: DTO.worn, version: 3 })).rejects.toBeInstanceOf(ApiError);
  expect(getCosmetics()!.version).toBe(4);
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
  put.mockResolvedValueOnce({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.dots' }, version: 4 });
  await act(async () => { await saveCosmeticsLoadout({ room: { ...DTO.room, wallpaper: 'wall.dots' }, worn: DTO.worn, version: 3 }); });
  await act(async () => { finish(DTO); await pending; });
  expect([getCosmetics()!.room.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  get.mockResolvedValueOnce({ ...DTO, room: { ...DTO.room, wallpaper: 'wall.brick' }, version: 5 });
  await act(async () => { await loadCosmetics(); });
  expect([getCosmetics()!.room.wallpaper, getCosmetics()!.version]).toEqual(['wall.brick', 5]);
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

it('useCosmetics is null until the first read', () => {
  const { result } = renderHook(() => useCosmetics());
  expect(result.current).toBeNull();
});
