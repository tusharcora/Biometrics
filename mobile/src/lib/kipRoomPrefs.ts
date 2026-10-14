import * as SecureStore from 'expo-secure-store';

// "Shrink room" (spec §3.5): remembered on this device only, never sent to the server. The repo's device-storage
// pattern (as the thinking cache): a keychain failure reads as the default, expanded.
const KEY = 'kipRoomShrunk';

export async function readKipRoomShrunk(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeKipRoomShrunk(shrunk: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, shrunk ? '1' : '0');
  } catch {
    // The choice still holds for this session.
  }
}
