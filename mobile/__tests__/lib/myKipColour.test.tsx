import { act, renderHook } from '@testing-library/react-native';
import { fetchIdentity } from '../../src/api/buddies';
import { kipColourName, kipColourOf, KIP_COLOUR_ORDER } from '../../src/lib/kip/kipColour';
import { getMyKipColour, loadMyKipColour, resetMyKipColour, setMyKipColour, useMyKipColour } from '../../src/lib/kip/myKipColour';

jest.mock('../../src/api/buddies', () => ({ fetchIdentity: jest.fn() }));
const identity = fetchIdentity as jest.Mock;

beforeEach(() => {
  identity.mockReset();
  resetMyKipColour();
});

it('reads a missing or unknown name as coral, and names colours for people', () => {
  expect(kipColourOf('mint')).toBe('mint');
  expect(kipColourOf('teal')).toBe('coral');
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
  act(() => resetMyKipColour());
  expect(result.current).toBe('coral');
});

it('a load that started before a reset never lands after it', async () => {
  let finish!: (v: unknown) => void;
  identity.mockReturnValue(new Promise((r) => { finish = r; }));
  const pending = loadMyKipColour();
  resetMyKipColour();
  finish({ kipColour: 'mint' });
  await pending;
  expect(getMyKipColour()).toBe('coral');
});
