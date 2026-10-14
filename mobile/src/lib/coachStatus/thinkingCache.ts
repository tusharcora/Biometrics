import * as SecureStore from 'expo-secure-store';
import { resolveThinkingText, type ThinkingTextId } from '../thinkingText';

// The device cache (spec §1 Decoupling 5): `thinking` holds the last thinking text this device showed, so a cold
// start draws it before the status arrives. It is a look only, so every keychain failure is swallowed (as
// theme/preference.ts does). The retired `characterId` key is deleted once.
const THINKING_KEY = 'thinking';
const RETIRED_CHARACTER_KEY = 'characterId';

export async function readCachedThinkingText(): Promise<ThinkingTextId | null> {
  try {
    const raw = await SecureStore.getItemAsync(THINKING_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return resolveThinkingText((v as { text?: unknown }).text);
  } catch {
    return null;
  }
}

export async function writeCachedThinkingText(text: ThinkingTextId): Promise<void> {
  try {
    await SecureStore.setItemAsync(THINKING_KEY, JSON.stringify({ text }));
  } catch {
    // The next cold start shows Steps until the status arrives.
  }
}

export async function clearCachedThinking(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(THINKING_KEY);
  } catch {
    // Replaced by the next account's status.
  }
}

export async function purgeCachedCharacter(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RETIRED_CHARACTER_KEY);
  } catch {
    // Nothing reads it any more.
  }
}
