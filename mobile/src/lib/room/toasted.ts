import * as SecureStore from 'expo-secure-store';
import { EMPTY_TOASTED, type Toasted } from './announce';

// The pieces this device has toasted (spec §4, ruling 11): SecureStore key `kipToasted`, a few ids and a count, far
// under the ~2 KB value limit. A keychain failure reads as nothing toasted: a toast may repeat, nothing breaks. The
// record belongs to the signed-in account, so signing out clears it (clearToasted).
const KEY = 'kipToasted';

export async function readToasted(): Promise<Toasted> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Toasted>) : null;
    if (!parsed || !Array.isArray(parsed.ids) || typeof parsed.backfill !== 'number') return EMPTY_TOASTED;
    return { ids: parsed.ids.filter((i): i is string => typeof i === 'string'), backfill: parsed.backfill };
  } catch {
    return EMPTY_TOASTED;
  }
}

export async function writeToasted(t: Toasted): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(t));
  } catch {
    // Held for this session only.
  }
}

export async function clearToasted(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // The next account may miss one backfill summary; nothing breaks.
  }
}
