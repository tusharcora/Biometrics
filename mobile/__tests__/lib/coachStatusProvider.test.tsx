import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { CoachStatusProvider, useCoachStatusContext } from '../../src/lib/coachStatus/CoachStatusProvider';
import { useCoachStatus } from '../../src/lib/useCoachStatus';
import { useCharacterOptional } from '../../src/characters/CharacterContext';
import { fetchCoachStatus, setCoachThinking, type CoachStatusDTO } from '../../src/api/coach';
import { ApiError, markNetworkError } from '../../src/api/client';
import * as cache from '../../src/lib/coachStatus/thinkingCache';

jest.mock('../../src/api/coach', () => ({ ...jest.requireActual('../../src/api/coach'), fetchCoachStatus: jest.fn(), setCoachThinking: jest.fn() }));
jest.mock('../../src/lib/coachStatus/thinkingCache');
let mockUserId: string | null = 'u1';
jest.mock('../../src/auth/AuthContext', () => ({
  useOptionalAuth: () => ({ session: mockUserId ? { userId: mockUserId } : null, isPending: false }),
}));

const fetchStatus = fetchCoachStatus as jest.Mock;
const STATUS: CoachStatusDTO = {
  enabled: true, consented: true, consent: { version: '2', summary: 's', dataItems: [] },
  personaId: 'kip', personaChosen: true, personas: [], thinkingText: 'typewriter',
};
const networkError = () => markNetworkError(new TypeError('Network request failed'));
const wrapper = ({ children }: { children: React.ReactNode }) => <CoachStatusProvider>{children}</CoachStatusProvider>;

beforeEach(() => {
  jest.resetAllMocks();
  mockUserId = 'u1';
  (cache.readCachedThinkingText as jest.Mock).mockResolvedValue(null);
  (cache.purgeCachedCharacter as jest.Mock).mockResolvedValue(undefined);
});

it('shares one status read across every caller', async () => {
  fetchStatus.mockResolvedValue(STATUS);
  const { result } = renderHook(() => [useCoachStatus(), useCoachStatus()] as const, { wrapper });
  await waitFor(() => expect(result.current[0].status).toEqual(STATUS));
  expect(result.current[1].status).toBe(result.current[0].status);
  expect(fetchStatus).toHaveBeenCalledTimes(1);
});

it('takes the thinking text from the status and keeps it cached', async () => {
  fetchStatus.mockResolvedValue(STATUS);
  const { result } = renderHook(() => useCoachStatusContext(), { wrapper });
  await waitFor(() => expect(result.current?.thinkingText).toBe('typewriter'));
  expect(cache.writeCachedThinkingText).toHaveBeenCalledWith('typewriter');
});

it('purges the retired characterId key once on first mount', async () => {
  fetchStatus.mockResolvedValue(STATUS);
  const { rerender } = renderHook(() => useCoachStatusContext(), { wrapper });
  await waitFor(() => expect(cache.purgeCachedCharacter).toHaveBeenCalledTimes(1));
  rerender({});
  await act(async () => {});
  expect(cache.purgeCachedCharacter).toHaveBeenCalledTimes(1);
});

it('a network failure sets offline and keeps the last status; the next success clears it', async () => {
  fetchStatus.mockResolvedValueOnce(STATUS);
  const { result } = renderHook(() => useCoachStatus(), { wrapper });
  await waitFor(() => expect(result.current.status).toEqual(STATUS));
  fetchStatus.mockRejectedValueOnce(networkError());
  await act(() => result.current.refresh());
  expect(result.current.offline).toBe(true);
  expect(result.current.status).toEqual(STATUS);
  fetchStatus.mockResolvedValueOnce(STATUS);
  await act(() => result.current.refresh());
  expect(result.current.offline).toBe(false);
});

it('any other failure is unknown (null), not offline', async () => {
  fetchStatus.mockRejectedValueOnce(new ApiError(503, 'x'));
  const { result } = renderHook(() => ({ hook: useCoachStatus(), ctx: useCoachStatusContext() }), { wrapper });
  // Settled first (ruling L1): otherwise this would only see the initial state.
  await waitFor(() => expect(result.current.ctx?.statusLoaded).toBe(true));
  expect(fetchStatus).toHaveBeenCalledTimes(1);
  expect(result.current.hook.status).toBeNull();
  expect(result.current.hook.offline).toBe(false);
});

it('chooses a thinking text optimistically and reverts when the save fails', async () => {
  fetchStatus.mockResolvedValue(STATUS);
  (setCoachThinking as jest.Mock).mockRejectedValueOnce(new Error('nope'));
  const { result } = renderHook(() => useCoachStatusContext()!, { wrapper });
  await waitFor(() => expect(result.current.thinkingText).toBe('typewriter'));
  await act(async () => { await expect(result.current.chooseThinkingText('lines')).rejects.toThrow('nope'); });
  expect(result.current.thinkingText).toBe('typewriter');
  expect(setCoachThinking).toHaveBeenCalledWith({ text: 'lines' });
});

it('signed out: nothing is fetched, the defaults show and the cache is cleared', async () => {
  mockUserId = null;
  const { result } = renderHook(() => useCoachStatusContext(), { wrapper });
  await waitFor(() => expect(cache.clearCachedThinking).toHaveBeenCalled());
  expect(fetchStatus).not.toHaveBeenCalled();
  expect(result.current?.thinkingText).toBe('steps');
});

it('the compatibility shim answers old callers from the new provider (ruling 1)', async () => {
  fetchStatus.mockResolvedValue(STATUS);
  const { result } = renderHook(() => useCharacterOptional(), { wrapper });
  await waitFor(() => expect(result.current?.status).toEqual(STATUS));
  expect(result.current).toMatchObject({ characterId: 'mochi', personaChosen: true, recoveryBand: null, thinkingText: 'typewriter' });
});
