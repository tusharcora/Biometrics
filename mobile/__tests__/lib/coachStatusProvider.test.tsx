import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { CoachStatusProvider, useCoachStatusContext } from '../../src/lib/coachStatus/CoachStatusProvider';
import { useCoachStatus } from '../../src/lib/useCoachStatus';
import { fetchCoachStatus, setCoachThinking, type CoachStatusDTO } from '../../src/api/coach';
import { ApiError, markNetworkError } from '../../src/api/client';
import * as cache from '../../src/lib/coachStatus/thinkingCache';
import { resyncWindDownTitle } from '../../src/lib/windDown';

jest.mock('../../src/api/coach', () => ({ ...jest.requireActual('../../src/api/coach'), fetchCoachStatus: jest.fn(), setCoachThinking: jest.fn() }));
jest.mock('../../src/lib/coachStatus/thinkingCache');
jest.mock('../../src/lib/windDown', () => ({ resyncWindDownTitle: jest.fn() }));
type MockAuth = { session: { userId: string } | null; isPending: boolean } | undefined;
let mockAuth: MockAuth;
jest.mock('../../src/auth/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
const signedIn = (userId = 'u1'): MockAuth => ({ session: { userId }, isPending: false });
const signedOut: MockAuth = { session: null, isPending: false };

const fetchStatus = fetchCoachStatus as jest.Mock;
const STATUS: CoachStatusDTO = {
  enabled: true, consented: true, consent: { version: '2', summary: 's', dataItems: [] },
  personaId: 'kip', personaChosen: true, personas: [], thinkingText: 'typewriter',
};
const networkError = () => markNetworkError(new TypeError('Network request failed'));
const wrapper = ({ children }: { children: React.ReactNode }) => <CoachStatusProvider>{children}</CoachStatusProvider>;
const renderCoach = () => renderHook(() => useCoachStatusContext()!, { wrapper });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = signedIn();
  (cache.readCachedThinkingText as jest.Mock).mockResolvedValue(null);
  (cache.purgeCachedCharacter as jest.Mock).mockResolvedValue(undefined);
  (resyncWindDownTitle as jest.Mock).mockResolvedValue(undefined);
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

it('resyncs the wind-down title to KIP once on first mount, signed in or not', async () => {
  mockAuth = signedOut;
  const { rerender } = renderHook(() => useCoachStatusContext(), { wrapper });
  await waitFor(() => expect(resyncWindDownTitle).toHaveBeenCalledTimes(1));
  mockAuth = signedIn();
  fetchStatus.mockResolvedValue(STATUS);
  rerender({});
  await act(async () => {});
  expect(resyncWindDownTitle).toHaveBeenCalledTimes(1);
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
  mockAuth = signedOut;
  const { result } = renderHook(() => useCoachStatusContext(), { wrapper });
  await waitFor(() => expect(cache.clearCachedThinking).toHaveBeenCalled());
  expect(fetchStatus).not.toHaveBeenCalled();
  expect(result.current?.thinkingText).toBe('steps');
});

describe('account and lifetime guards', () => {
  it('ignores a status reply that lands after sign-out', async () => {
    const reply = deferred<CoachStatusDTO>();
    fetchStatus.mockReturnValue(reply.promise);
    const { result, rerender } = renderCoach();
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());

    mockAuth = signedOut;
    rerender({});
    await act(async () => reply.resolve(STATUS));

    expect(result.current.status).toBeNull();
    expect(result.current.thinkingText).toBe('steps');
    expect(cache.writeCachedThinkingText).not.toHaveBeenCalled();
  });

  it('ignores a status reply that lands after unmount', async () => {
    const reply = deferred<CoachStatusDTO>();
    fetchStatus.mockReturnValue(reply.promise);
    const { unmount } = renderCoach();
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());

    unmount();
    await act(async () => reply.resolve(STATUS));

    expect(cache.writeCachedThinkingText).not.toHaveBeenCalled();
  });

  it("drops the previous account's late reply and loads the next account afresh after a switch", async () => {
    const first = deferred<CoachStatusDTO>();
    fetchStatus.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ ...STATUS, thinkingText: 'shimmer' });
    const { result, rerender } = renderCoach();
    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));

    mockAuth = signedIn('u2');
    rerender({});
    await waitFor(() => expect(result.current.thinkingText).toBe('shimmer'));
    await act(async () => first.resolve(STATUS));

    expect(result.current.thinkingText).toBe('shimmer');
    expect(result.current.status?.thinkingText).toBe('shimmer');
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache, and fetches or clears nothing, while the session is still loading on a cold start', async () => {
    mockAuth = { session: null, isPending: true };
    (cache.readCachedThinkingText as jest.Mock).mockResolvedValue('typewriter');
    const { result } = renderCoach();

    await waitFor(() => expect(result.current.thinkingText).toBe('typewriter'));
    expect(cache.clearCachedThinking).not.toHaveBeenCalled();
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it('treats no AuthProvider at all as signed out', async () => {
    mockAuth = undefined;
    const { result } = renderCoach();

    await waitFor(() => expect(cache.clearCachedThinking).toHaveBeenCalled());
    expect(result.current.thinkingText).toBe('steps');
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});

describe('the cached thinking text', () => {
  it('shows the cached text on a signed-in cold start, before the status arrives', async () => {
    (cache.readCachedThinkingText as jest.Mock).mockResolvedValue('typewriter');
    fetchStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderCoach();

    await waitFor(() => expect(result.current.thinkingText).toBe('typewriter'));
  });

  it("does not let a slow cache read replace the text the server already sent", async () => {
    const cached = deferred<string | null>();
    (cache.readCachedThinkingText as jest.Mock).mockReturnValue(cached.promise);
    fetchStatus.mockResolvedValue({ ...STATUS, thinkingText: 'shimmer' });
    const { result } = renderCoach();
    await waitFor(() => expect(result.current.thinkingText).toBe('shimmer'));

    await act(async () => cached.resolve('typewriter'));

    expect(result.current.thinkingText).toBe('shimmer');
  });
});

describe('chooseThinkingText guards', () => {
  it('is not undone by a status fetch that started before the choice and lands after the save', async () => {
    fetchStatus.mockResolvedValue(STATUS);
    (setCoachThinking as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderCoach();
    await waitFor(() => expect(result.current.statusLoaded).toBe(true));
    const stale = deferred<CoachStatusDTO>();
    fetchStatus.mockReturnValue(stale.promise);

    let refreshing!: Promise<void>;
    act(() => {
      refreshing = result.current.refreshStatus();
    });
    await act(async () => {
      await result.current.chooseThinkingText('lines');
    });
    (cache.writeCachedThinkingText as jest.Mock).mockClear();
    await act(async () => {
      stale.resolve(STATUS);
      await refreshing;
    });

    expect(result.current.thinkingText).toBe('lines');
    expect(result.current.status?.thinkingText).toBe('lines');
    expect(cache.writeCachedThinkingText).not.toHaveBeenCalled();
  });

  it('rejects an unknown id without changing or saving anything', async () => {
    fetchStatus.mockResolvedValue(STATUS);
    const { result } = renderCoach();
    await waitFor(() => expect(result.current.thinkingText).toBe('typewriter'));

    let caught: unknown;
    await act(async () => {
      await result.current.chooseThinkingText('dialog' as never).catch((e: unknown) => {
        caught = e;
      });
    });

    expect(caught).toBeInstanceOf(Error);
    expect(result.current.thinkingText).toBe('typewriter');
    expect(setCoachThinking).not.toHaveBeenCalled();
  });

  it('does nothing while signed out', async () => {
    mockAuth = signedOut;
    const { result } = renderCoach();
    await waitFor(() => expect(cache.clearCachedThinking).toHaveBeenCalled());

    await act(async () => {
      await result.current.chooseThinkingText('typewriter');
    });

    expect(result.current.thinkingText).toBe('steps');
    expect(setCoachThinking).not.toHaveBeenCalled();
    expect(cache.writeCachedThinkingText).not.toHaveBeenCalled();
  });
});
