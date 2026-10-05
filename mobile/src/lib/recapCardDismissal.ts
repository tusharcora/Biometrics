import * as SecureStore from 'expo-secure-store';

// The Home "recap ready" card's dismissal: the id of the last recap the user waved away, so a newer
// recap shows again. A keychain failure just shows the card; nothing else depends on it.
const KEY = 'recapCardDismissed';

export async function readDismissedRecapId(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(KEY)) || null;
  } catch {
    return null;
  }
}

export async function writeDismissedRecapId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, id);
  } catch {
    // The card comes back next launch; harmless.
  }
}
