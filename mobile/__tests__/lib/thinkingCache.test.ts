import * as SecureStore from 'expo-secure-store';
import {
  clearCachedThinking, purgeCachedCharacter, readCachedThinkingText, writeCachedThinkingText,
} from '../../src/lib/coachStatus/thinkingCache';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const store = SecureStore as jest.Mocked<typeof SecureStore>;
beforeEach(() => jest.resetAllMocks());

it('reads only the text half of the old cached settings; a retired style reads as steps', async () => {
  store.getItemAsync.mockResolvedValueOnce(JSON.stringify({ attachment: 'bulb', text: 'typewriter' }));
  expect(await readCachedThinkingText()).toBe('typewriter');
  store.getItemAsync.mockResolvedValueOnce(JSON.stringify({ attachment: 'gears', text: 'dialog' }));
  expect(await readCachedThinkingText()).toBe('steps');
});

it('reads nothing from an empty or broken entry, or a keychain that throws', async () => {
  store.getItemAsync.mockResolvedValueOnce(null);
  expect(await readCachedThinkingText()).toBeNull();
  store.getItemAsync.mockResolvedValueOnce('{oops');
  expect(await readCachedThinkingText()).toBeNull();
  store.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await readCachedThinkingText()).toBeNull();
});

it('writes the text alone, so a cached attachment is dropped on the next write', async () => {
  await writeCachedThinkingText('lines');
  expect(store.setItemAsync).toHaveBeenCalledWith('thinking', JSON.stringify({ text: 'lines' }));
});

it('purges the retired characterId key and swallows a keychain failure', async () => {
  await purgeCachedCharacter();
  expect(store.deleteItemAsync).toHaveBeenCalledWith('characterId');
  store.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
  await expect(purgeCachedCharacter()).resolves.toBeUndefined();
});

it('clears the thinking key on sign-out', async () => {
  await clearCachedThinking();
  expect(store.deleteItemAsync).toHaveBeenCalledWith('thinking');
});
