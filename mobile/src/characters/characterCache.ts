import * as SecureStore from 'expo-secure-store';
import { isCharacterId, type CharacterId } from '../components/characters/types';

const STORAGE_KEY = 'characterId';

// The last character this device showed for the signed-in account, so a cold
// start draws the right one before the coach status arrives. The character is
// only a look: a keychain failure (e.g. an unsigned build) is never worth an
// error, so every call here swallows it, as theme/preference.ts does.
export async function readCachedCharacter(): Promise<CharacterId | null> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    return isCharacterId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function writeCachedCharacter(id: CharacterId): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, id);
  } catch {
    // Next cold start shows Hoot until the status arrives; nothing else breaks.
  }
}

export async function clearCachedCharacter(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Nothing to do: a stale entry is replaced by the next account's status.
  }
}
