import * as SecureStore from 'expo-secure-store';
import { clearCachedCharacter, readCachedCharacter, writeCachedCharacter } from '../../src/characters/characterCache';

jest.mock('expo-secure-store');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('readCachedCharacter', () => {
  it('returns the stored character', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ember');

    await expect(readCachedCharacter()).resolves.toBe('ember');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('characterId');
  });

  it('returns null when nothing is stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await expect(readCachedCharacter()).resolves.toBeNull();
  });

  it('returns null for an id this app does not know (e.g. from a newer build)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('luna');

    await expect(readCachedCharacter()).resolves.toBeNull();
  });

  it('returns null, and does not reject, when the keychain read fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('A required entitlement is not present'));

    await expect(readCachedCharacter()).resolves.toBeNull();
  });
});

describe('writeCachedCharacter', () => {
  it('stores the id under characterId', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await writeCachedCharacter('doze');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('characterId', 'doze');
  });

  it('does not reject when the keychain write fails', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('locked'));

    await expect(writeCachedCharacter('doze')).resolves.toBeUndefined();
  });
});

describe('clearCachedCharacter', () => {
  it('deletes the characterId entry', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    await clearCachedCharacter();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('characterId');
  });

  it('does not reject when the keychain delete fails', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('locked'));

    await expect(clearCachedCharacter()).resolves.toBeUndefined();
  });
});
