import { act, renderHook } from '@testing-library/react-native';
import { fetchIdentity } from '../../src/api/buddies';
import { kipColourName, kipColourOf, KIP_COLOUR_ORDER } from '../../src/lib/kip/kipColour';
import { saveKipColour } from '../../src/api/kip';
import {
  getMyKip, getMyKipColour, loadMyKipColour, myKipColourLoadFailed, resetMyKip, saveMyKipColour, setMyKipColour, setMyKipWorn,
  useMyKip, useMyKipColour,
} from '../../src/lib/kip/myKip';

jest.mock('../../src/api/buddies', () => ({ fetchIdentity: jest.fn() }));
jest.mock('../../src/api/kip', () => ({ saveKipColour: jest.fn() }));
const identity = fetchIdentity as jest.Mock;
const saveKip = saveKipColour as jest.Mock;

beforeEach(() => {
  identity.mockReset();
  saveKip.mockReset();
  resetMyKip();
});

it('reads a missing or unknown name as coral, and names colours for people', () => {
  expect(kipColourOf('mint')).toBe('mint');
  expect(kipColourOf('teal')).toBe('coral');
  expect(kipColourOf('toString')).toBe('coral');
  expect(kipColourOf(undefined)).toBe('coral');
  expect(KIP_COLOUR_ORDER).toEqual(['coral', 'cobalt', 'ink', 'lemon', 'lilac', 'lime', 'mint', 'sky', 'slate', 'snow']);
  expect(kipColourName('sky')).toBe('Sky');
});

it('is coral until the identity read lands, then the saved colour', async () => {
  identity.mockResolvedValue({ kipColour: 'lilac' });
  const { result } = renderHook(() => useMyKipColour());
  expect(result.current).toBe('coral');
  await act(async () => {
    await loadMyKipColour();
  });
  expect(result.current).toBe('lilac');
});

it('stays coral when the read fails or an older server leaves the field out', async () => {
  identity.mockRejectedValueOnce(new Error('offline'));
  await loadMyKipColour();
  expect(getMyKipColour()).toBe('coral');
  identity.mockResolvedValueOnce({ handle: 'sam' });
  await loadMyKipColour();
  expect(getMyKipColour()).toBe('coral');
});

it('a save updates every reader, and a reset (sign-out) forgets it', async () => {
  const { result } = renderHook(() => useMyKipColour());
  act(() => setMyKipColour('ink'));
  expect(result.current).toBe('ink');
  act(() => resetMyKip());
  expect(result.current).toBe('coral');
});

it('a load that started before a reset never lands after it', async () => {
  let finish!: (v: unknown) => void;
  identity.mockReturnValue(new Promise((r) => { finish = r; }));
  const pending = loadMyKipColour();
  resetMyKip();
  finish({ kipColour: 'mint' });
  await pending;
  expect(getMyKipColour()).toBe('coral');
});

it('a slow first read that lands after a save never overwrites it', async () => {
  let finish!: (v: unknown) => void;
  identity.mockReturnValue(new Promise((r) => { finish = r; }));
  const pending = loadMyKipColour();
  setMyKipColour('mint');
  finish({ kipColour: 'coral' });
  await pending;
  expect(getMyKipColour()).toBe('mint');
});

it('a save stores the colour once the server takes it, and throws when it does not', async () => {
  saveKip.mockResolvedValueOnce({ kipColour: 'lime' });
  await saveMyKipColour('lime');
  expect(saveKip).toHaveBeenCalledWith('lime');
  expect(getMyKipColour()).toBe('lime');
  saveKip.mockRejectedValueOnce(new Error('offline'));
  await expect(saveMyKipColour('ink')).rejects.toThrow('offline');
  expect(getMyKipColour()).toBe('lime');
});

it('a save that finishes after sign-out never lands in the next account', async () => {
  let finish!: (v: unknown) => void;
  saveKip.mockReturnValue(new Promise((r) => { finish = r; }));
  const pending = saveMyKipColour('mint');
  resetMyKip();
  finish({ kipColour: 'mint' });
  await pending;
  expect(getMyKipColour()).toBe('coral');
});

it('remembers a failed read until a read, save or sign-out', async () => {
  expect(myKipColourLoadFailed()).toBe(false);
  identity.mockRejectedValueOnce(new Error('offline'));
  await loadMyKipColour();
  expect(myKipColourLoadFailed()).toBe(true);
  identity.mockResolvedValueOnce({ kipColour: 'sky' });
  await loadMyKipColour();
  expect(myKipColourLoadFailed()).toBe(false);
  identity.mockRejectedValueOnce(new Error('offline'));
  await loadMyKipColour();
  setMyKipColour('ink');
  expect(myKipColourLoadFailed()).toBe(false);
  identity.mockRejectedValueOnce(new Error('offline'));
  await loadMyKipColour();
  resetMyKip();
  expect(myKipColourLoadFailed()).toBe(false);
});

it('holds what KIP wears beside the colour; ids this build cannot draw are dropped; sign-out forgets both', async () => {
  const { result } = renderHook(() => useMyKip());
  expect(result.current.worn).toEqual({ head: null, face: null, neck: null, ears: null });
  act(() => setMyKipWorn({ head: 'out.cap', face: 'out.fromTheFuture', neck: null, ears: 'out.earbuds' }));
  expect(result.current.worn).toEqual({ head: 'out.cap', face: null, neck: null, ears: 'out.earbuds' });
  act(() => setMyKipColour('mint'));
  expect(getMyKip()).toEqual({ colour: 'mint', worn: { head: 'out.cap', face: null, neck: null, ears: 'out.earbuds' } });
  act(() => resetMyKip());
  expect(getMyKip()).toEqual({ colour: 'coral', worn: { head: null, face: null, neck: null, ears: null } });
});
