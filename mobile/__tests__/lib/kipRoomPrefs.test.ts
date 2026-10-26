import * as SecureStore from 'expo-secure-store';
import { readKipRoomShrunk, writeKipRoomShrunk } from '../../src/lib/kipRoomPrefs';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
const store = SecureStore as jest.Mocked<typeof SecureStore>;
beforeEach(() => jest.resetAllMocks());

it('defaults to expanded, and reads "1" as shrunk', async () => {
  store.getItemAsync.mockResolvedValueOnce(null);
  expect(await readKipRoomShrunk()).toBe(false);
  store.getItemAsync.mockResolvedValueOnce('1');
  expect(await readKipRoomShrunk()).toBe(true);
});

it('a keychain failure reads as expanded and a failed write is swallowed', async () => {
  store.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await readKipRoomShrunk()).toBe(false);
  store.setItemAsync.mockRejectedValueOnce(new Error('locked'));
  await expect(writeKipRoomShrunk(true)).resolves.toBeUndefined();
});

it('writes under kipRoomShrunk', async () => {
  await writeKipRoomShrunk(true);
  expect(store.setItemAsync).toHaveBeenCalledWith('kipRoomShrunk', '1');
  await writeKipRoomShrunk(false);
  expect(store.setItemAsync).toHaveBeenLastCalledWith('kipRoomShrunk', '0');
});
