import { useSyncExternalStore } from 'react';
import { fetchIdentity } from '../../api/buddies';
import { saveKipColour } from '../../api/kip';
import { DEFAULT_KIP_COLOUR, type KipColour } from './kipArt';
import { kipColourOf } from './kipColour';
import { kipWornOf } from './wornArt';
import { EMPTY_WORN, type KipWorn } from '../room/loadout';

// Your KIP (spec 2026-10-13 KIP colour §3; spec 2026-10-14 KIP's room §7): its colour (from the identity read) and
// what it wears (from GET /me/cosmetics, via the cosmetics store), loaded once per sign-in by MyKipScope (the colour
// again by the picker if that read failed), coral and bare until then or when a read fails, updated by a save, and
// forgotten on sign-out so the next account starts fresh.

export interface MyKip {
  colour: KipColour;
  worn: KipWorn;
}

let me: MyKip = { colour: DEFAULT_KIP_COLOUR, worn: EMPTY_WORN };
let epoch = 0;
let loadFailed = false;
const listeners = new Set<() => void>();

function publish(next: Partial<MyKip>): void {
  me = { ...me, ...next };
  listeners.forEach((l) => l());
}

export function getMyKip(): MyKip {
  return me;
}

export function getMyKipColour(): KipColour {
  return me.colour;
}

/** Whether the last read failed, so the picker can try again rather than show coral as saved. */
export function myKipColourLoadFailed(): boolean {
  return loadFailed;
}

export async function loadMyKipColour(): Promise<void> {
  const at = epoch;
  try {
    const identity = await fetchIdentity();
    if (at !== epoch) return;
    loadFailed = false;
    publish({ colour: kipColourOf(identity?.kipColour) });
  } catch {
    // Keep what is shown; the next sign-in, save or visit to the picker tries again.
    if (at === epoch) loadFailed = true;
  }
}

// Every write moves the epoch, so a read already in flight can't land over it.
export function setMyKipColour(next: KipColour): void {
  epoch++;
  loadFailed = false;
  publish({ colour: next });
}

/** Saves to the server, then shows it everywhere unless you signed out meanwhile. Throws when the save fails. */
export async function saveMyKipColour(next: KipColour): Promise<void> {
  const at = epoch;
  await saveKipColour(next);
  if (at === epoch) setMyKipColour(next);
}

/** What KIP wears, from the server's worn record; pieces this build cannot draw are dropped (§7). */
export function setMyKipWorn(raw: unknown): void {
  publish({ worn: kipWornOf(raw) });
}

export function resetMyKip(): void {
  epoch++;
  loadFailed = false;
  publish({ colour: DEFAULT_KIP_COLOUR, worn: EMPTY_WORN });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMyKip(): MyKip {
  return useSyncExternalStore(subscribe, getMyKip, getMyKip);
}

export function useMyKipColour(): KipColour {
  return useSyncExternalStore(subscribe, getMyKipColour, getMyKipColour);
}
