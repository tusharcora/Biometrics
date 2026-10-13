import { useSyncExternalStore } from 'react';
import { fetchIdentity } from '../../api/buddies';
import { DEFAULT_KIP_COLOUR, type KipColour } from './kipArt';
import { kipColourOf } from './kipColour';

// Your KIP's colour (spec 2026-10-13 KIP colour §3): loaded once per sign-in by MyKipColourScope, coral until
// then or when the read fails, updated by a save, and forgotten on sign-out so the next account starts fresh.

let colour: KipColour = DEFAULT_KIP_COLOUR;
let epoch = 0;
const listeners = new Set<() => void>();

function publish(next: KipColour): void {
  colour = next;
  listeners.forEach((l) => l());
}

export function getMyKipColour(): KipColour {
  return colour;
}

export async function loadMyKipColour(): Promise<void> {
  const at = epoch;
  try {
    const identity = await fetchIdentity();
    if (at === epoch) publish(kipColourOf(identity?.kipColour));
  } catch {
    // Keep what is shown; the next sign-in or save tries again.
  }
}

export function setMyKipColour(next: KipColour): void {
  publish(next);
}

export function resetMyKipColour(): void {
  epoch++;
  publish(DEFAULT_KIP_COLOUR);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMyKipColour(): KipColour {
  return useSyncExternalStore(subscribe, getMyKipColour, getMyKipColour);
}
