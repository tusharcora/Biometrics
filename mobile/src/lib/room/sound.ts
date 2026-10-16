import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

// The radio's sound switch (spec 2026-10-15 §8.2, P3 ruling 15): off until you turn it on, remembered on this device
// only, never sent to the server. The repo's device-storage pattern (kipRoomPrefs.ts): a keychain failure reads as off.
export const ROOM_SOUND_KEY = 'kipRoomSound';

let on = false;
// Once you flip the switch this session, that choice is the truth: no stored read replaces it (ruling PF3-AUDIO).
let chosen = false;
// Moves on every toggle and reset, so a read begun before one lands as nothing.
let epoch = 0;
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  if (next === on) return;
  on = next;
  listeners.forEach((l) => l());
};

export async function loadRoomSound(): Promise<boolean> {
  if (chosen) return on;
  const mine = epoch;
  let stored = false;
  try {
    stored = (await SecureStore.getItemAsync(ROOM_SOUND_KEY)) === '1';
  } catch {
    stored = false;
  }
  if (mine === epoch) publish(stored);
  return on;
}

export async function setRoomSound(next: boolean): Promise<void> {
  epoch++;
  chosen = true;
  publish(next);
  try {
    await SecureStore.setItemAsync(ROOM_SOUND_KEY, next ? '1' : '0');
  } catch {
    // The choice still holds for this session.
  }
}

export function getRoomSound(): boolean {
  return on;
}

export function resetRoomSound(): void {
  epoch++;
  chosen = false;
  publish(false);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function useRoomSound(): boolean {
  return useSyncExternalStore(subscribe, getRoomSound, getRoomSound);
}
