import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { fetchRecoveryMonth, fetchRecoveryPage, type RecoveryPageDTO } from '../../src/api/recovery';
import { useRecoveryPage } from '../../src/lib/useRecoveryPage';

jest.mock('../../src/api/recovery', () => ({ fetchRecoveryPage: jest.fn(), fetchRecoveryMonth: jest.fn() }));
jest.mock('../../src/sync/SyncProvider', () => ({ useSync: () => ({ dataVersion: 0 }) }));

// Runs the focus callback once on mount, like a screen that mounts focused, and keeps the
// latest callback so a test can simulate the screen regaining focus.
let mockFocusCallback: (() => void) | null = null;
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void) => {
      mockFocusCallback = cb;
      R.useEffect(cb, []);
    },
  };
});
const refocus = () => act(() => { mockFocusCallback?.(); });

const pageFetch = fetchRecoveryPage as jest.Mock;
const monthFetch = fetchRecoveryMonth as jest.Mock;

const MONTH = { month: '2026-10', days: [{ date: '2026-10-08', score: 68 }], average: 68, counts: { excellent: 0, good: 1, fair: 0, low: 0 } };
const PAGE = { date: '2026-10-08', isToday: true, state: 'READY', month: MONTH } as unknown as RecoveryPageDTO;
const SEPT = { month: '2026-09', days: [], average: null, counts: { excellent: 0, good: 0, fair: 0, low: 0 } };

beforeEach(() => {
  pageFetch.mockReset();
  monthFetch.mockReset();
  mockFocusCallback = null;
});

describe('useRecoveryPage', () => {
  it('starts loading, then is ready with the page for today', async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage());
    expect(result.current.state).toBe('loading');
    expect(result.current.page).toBeNull();
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.page).toBe(PAGE);
    expect(result.current.errorKind).toBeNull();
    expect(pageFetch).toHaveBeenCalledWith('today');
  });

  it('fetches a past day by its date', async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage('2026-10-02'));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(pageFetch).toHaveBeenCalledWith('2026-10-02');
  });

  it('fetches today once on mount, and again only when the screen regains focus', async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(pageFetch).toHaveBeenCalledTimes(1);
    refocus();
    await waitFor(() => expect(pageFetch).toHaveBeenCalledTimes(2));
    expect(result.current.state).toBe('ready');
  });

  it('does not refetch a past day on focus', async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage('2026-10-02'));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    refocus();
    expect(pageFetch).toHaveBeenCalledTimes(1);
  });

  it('a rejection is an error of kind other; a 400 is a future day', async () => {
    pageFetch.mockRejectedValue(new Error('boom'));
    const other = renderHook(() => useRecoveryPage());
    await waitFor(() => expect(other.result.current.state).toBe('error'));
    expect(other.result.current.errorKind).toBe('other');

    pageFetch.mockRejectedValue({ status: 400 });
    const future = renderHook(() => useRecoveryPage('2026-12-01'));
    await waitFor(() => expect(future.result.current.state).toBe('error'));
    expect(future.result.current.errorKind).toBe('future');
  });

  it("the bundle's month is ready straight away, with no month fetch", async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.month('2026-10')).toEqual({ status: 'ready', data: MONTH });
    expect(monthFetch).not.toHaveBeenCalled();
  });

  it('loadMonth fetches a month once and caches it', async () => {
    pageFetch.mockResolvedValue(PAGE);
    monthFetch.mockResolvedValue({ month: SEPT, bands: { excellent: 75, good: 55, fair: 40 } });
    const { result } = renderHook(() => useRecoveryPage());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => result.current.loadMonth('2026-09'));
    expect(result.current.month('2026-09')).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.month('2026-09')).toEqual({ status: 'ready', data: SEPT }));
    act(() => result.current.loadMonth('2026-09'));
    expect(monthFetch).toHaveBeenCalledTimes(1);
    expect(monthFetch).toHaveBeenCalledWith('2026-09');
  });

  it('a failed month load is an error', async () => {
    pageFetch.mockResolvedValue(PAGE);
    monthFetch.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRecoveryPage());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => result.current.loadMonth('2026-09'));
    await waitFor(() => expect(result.current.month('2026-09')).toEqual({ status: 'error' }));
  });

  it('reload refetches', async () => {
    pageFetch.mockResolvedValue(PAGE);
    const { result } = renderHook(() => useRecoveryPage('2026-10-02'));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(pageFetch).toHaveBeenCalledTimes(2);
  });
});
